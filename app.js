import { matchupLabel } from './lib.js';
import { getProvider, DEFAULT_LEAGUE } from './sports/index.js';

let currentProvider = getProvider(DEFAULT_LEAGUE);

const MAX_SUGGESTIONS = 8;
const REVEAL_STEP_MS = 4;      // per-cell stagger
const REVEAL_CAP_MS = 640;     // never take longer than this to light the whole board
const MIN_FADE_MS = 240;       // ensure the old lights read as "fading out" before the new sweep

const el = {
  search: document.getElementById('search-field'),
  suggestions: document.getElementById('suggestions'),
  board: document.getElementById('board'),
  nameplate: document.getElementById('nameplate'),
  grid: document.getElementById('grid'),
  legend: document.getElementById('legend'),
  error: document.getElementById('error-msg'),
  status: document.getElementById('sr-status'),
  tooltip: document.getElementById('tooltip'),
  tipMatchup: document.getElementById('tooltip-matchup'),
  tipLine: document.getElementById('tooltip-line'),
};

let players = [];      // [{ id, fullName, teamId, teamAbbrev }]

function show(node, on) { node.classList.toggle('hidden', !on); }
function showError(msg) { el.error.textContent = msg; show(el.error, true); }
function clearError() { el.error.textContent = ''; show(el.error, false); }

async function getJSON(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
  return resp.json();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ========================================================================
   The board: a persistent grid of game slots
   ======================================================================== */
const boardCells = [];

function resetCell(c) {
  c.style.transitionDelay = '0ms';
  c.dataset.state = 'future';
  c.removeAttribute('data-level');
  c.removeAttribute('role');
  c.removeAttribute('aria-label');
  c.setAttribute('aria-hidden', 'true');
  c.tabIndex = -1;
  delete c.dataset.matchup;
  delete c.dataset.line;
}

function ensureBoard(n) {
  const frag = document.createDocumentFragment();
  while (boardCells.length < n) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.state = 'future';
    c.tabIndex = -1;
    c.setAttribute('aria-hidden', 'true');
    boardCells.push(c);
    frag.appendChild(c);
  }
  if (frag.childNodes.length) el.grid.appendChild(frag);
}
ensureBoard(currentProvider.seasonBoxes);

let sweepTimer = null;
let fadeStart = 0;

// Return every slot to a dark, unplayed socket — the "lights fade out" pass.
function fadeBoardOff() {
  if (sweepTimer) { clearTimeout(sweepTimer); sweepTimer = null; }
  for (const c of boardCells) resetCell(c);
  fadeStart = (typeof performance !== 'undefined' ? performance.now() : 0);
}

// Apply one slot record to one cell. Three states:
//   played  — the player appeared; lit by total bases, focusable, full tooltip.
//   missed  — the team played, the player did not (e.g. injured); muted, hover tooltip only.
//   future  — the team game hasn't happened yet; a dark socket, inert.
function applySlot(c, slot, ordinal) {
  if (slot.state === 'played') {
    const matchup = matchupLabel(slot.isHome, slot.opp);
    c.dataset.state = 'played';
    c.dataset.level = String(currentProvider.levelForValue(slot.value));
    c.dataset.matchup = matchup;
    c.dataset.line = slot.tooltipLine || '';
    c.tabIndex = 0;
    c.removeAttribute('aria-hidden');
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', currentProvider.boxAria(slot, ordinal));
  } else if (slot.state === 'missed') {
    c.dataset.state = 'missed';
    c.removeAttribute('data-level');
    c.dataset.matchup = matchupLabel(slot.isHome, slot.opp);
    c.dataset.line = 'Did not play';
    c.tabIndex = -1;
    c.removeAttribute('role');
    c.removeAttribute('aria-label');
    c.setAttribute('aria-hidden', 'true');
  } else {
    resetCell(c); // future socket
  }
}

// Lay the season out across the board in schedule order, staggered ignite.
function lightUpBoard(slots, requestId) {
  ensureBoard(Math.max(currentProvider.seasonBoxes, slots.length));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let playedOrdinal = 0;
  slots.forEach((slot, i) => {
    const c = boardCells[i];
    c.style.transitionDelay = reduce ? '0ms' : `${Math.min(i * REVEAL_STEP_MS, REVEAL_CAP_MS)}ms`;
    if (slot.state === 'played') playedOrdinal += 1;
    applySlot(c, slot, playedOrdinal);
  });
  // Any cells past the schedule length stay as future sockets.
  for (let i = slots.length; i < boardCells.length; i++) resetCell(boardCells[i]);

  // Once the sweep is done, drop the per-cell delays so hover feedback is instant.
  if (!reduce) {
    sweepTimer = setTimeout(() => {
      if (requestId !== currentRequestId) return;
      for (const c of boardCells) c.style.transitionDelay = '0ms';
    }, REVEAL_CAP_MS + 450);
  }
}

async function loadPlayers() {
  players = await currentProvider.loadPlayers();
}

loadPlayers().catch((err) => {
  console.error(err);
  showError('Could not load the player list. Refresh to try again.');
});

/* ========================================================================
   Search + suggestions
   ======================================================================== */
let activeIndex = -1;
let matches = [];
let currentRequestId = 0;
let lastQuery = '';

function setExpanded(on) { el.search.setAttribute('aria-expanded', String(on)); }

function closeSuggestions() {
  show(el.suggestions, false);
  setExpanded(false);
  el.search.removeAttribute('aria-activedescendant');
}

function renderSuggestions() {
  if (!matches.length) {
    if (lastQuery) {
      el.suggestions.innerHTML =
        '<li class="suggestion suggestion--empty" role="option" aria-disabled="true">No players found</li>';
      show(el.suggestions, true);
      setExpanded(true);
    } else {
      closeSuggestions();
    }
    return;
  }
  el.suggestions.innerHTML = matches
    .map((p, i) => `
      <li class="suggestion ${i === activeIndex ? 'is-active' : ''}"
          id="suggestion-${i}" role="option" data-i="${i}"
          aria-selected="${i === activeIndex}">
        <span class="suggestion__name">${escapeHtml(p.fullName)}</span>
        <span class="suggestion__team">${escapeHtml(p.teamAbbrev || '')}</span>
      </li>`)
    .join('');
  show(el.suggestions, true);
  setExpanded(true);
  if (activeIndex >= 0) el.search.setAttribute('aria-activedescendant', `suggestion-${activeIndex}`);

  el.suggestions.querySelectorAll('.suggestion[data-i]').forEach((node) => {
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectPlayer(matches[Number(node.dataset.i)]);
    });
  });
}

function updateMatches(query) {
  const q = query.trim().toLowerCase();
  lastQuery = q;
  if (!q) { matches = []; activeIndex = -1; closeSuggestions(); return; }
  matches = players
    .filter((p) => p.fullName.toLowerCase().includes(q))
    .slice(0, MAX_SUGGESTIONS);
  activeIndex = matches.length ? 0 : -1;
  renderSuggestions();
}

el.search.addEventListener('input', (e) => updateMatches(e.target.value));

el.search.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSuggestions(); return; }
  if (!matches.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex = (activeIndex + 1) % matches.length;
    renderSuggestions();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex = (activeIndex - 1 + matches.length) % matches.length;
    renderSuggestions();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (activeIndex >= 0) selectPlayer(matches[activeIndex]);
  }
});

document.addEventListener('click', (e) => {
  if (!el.search.contains(e.target) && !el.suggestions.contains(e.target)) {
    closeSuggestions();
  }
});

function selectPlayer(player) {
  el.search.value = player.fullName;
  closeSuggestions();
  matches = [];
  loadPlayer(player);
}

/* ========================================================================
   Load + render a player's season
   ======================================================================== */
function renderNameplateLoading(player) {
  const teamAbbr = player.teamAbbrev || '';
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">
      <span class="nameplate__loading">${teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}Loading season…</span>
    </div>`;
}

function renderNameplate(player, slots) {
  const teamAbbr = player.teamAbbrev || '';
  const stats = currentProvider.nameplateStats(slots);
  const statsHtml = stats.map((s, i) =>
    `<div class="stat"><span class="stat__value">${escapeHtml(String(s.value))}</span><span class="stat__label">${i === 0 && teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}${escapeHtml(s.label)}</span></div>`
  ).join('');
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">${statsHtml}</div>`;
}

async function loadPlayer(player) {
  const requestId = ++currentRequestId;
  clearError();
  show(el.nameplate, true);
  renderNameplateLoading(player);
  hideTooltip();
  fadeBoardOff();

  try {
    const { slots, empty } = await currentProvider.loadPlayerSeason(player);
    if (requestId !== currentRequestId) return;

    if (empty) {
      show(el.nameplate, false);
      show(el.legend, false);
      showError(`No ${currentProvider.name} games for ${player.fullName} yet — check back later.`);
      return;
    }

    const playedCount = slots.filter((s) => s.state === 'played').length;
    const teamGamesSoFar = slots.filter((s) => s.state !== 'future').length || playedCount;

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : MIN_FADE_MS) - fadeStart;
    const wait = Math.max(0, MIN_FADE_MS - elapsed);

    const apply = () => {
      if (requestId !== currentRequestId) return;
      renderNameplate(player, slots);
      show(el.legend, true);
      el.grid.setAttribute('aria-label',
        `${player.fullName}'s ${currentProvider.name} season — played ${playedCount} of the team's ${teamGamesSoFar} games so far, ${currentProvider.metricLabel} per ${currentProvider.unit}`);
      el.status.textContent =
        `${player.fullName}: played ${playedCount} of the team's ${teamGamesSoFar} games so far.`;
      lightUpBoard(slots, requestId);
    };
    if (wait > 0) setTimeout(apply, wait); else apply();
  } catch (err) {
    if (requestId !== currentRequestId) return;
    console.error(err);
    show(el.nameplate, false);
    show(el.legend, false);
    showError('Could not load that season. Please try again.');
  }
}

/* ========================================================================
   Tooltip — broadcast data chip (played games only)
   ======================================================================== */
let tipW = 0, tipH = 0;

// Tooltip targets: any game that actually happened — played or missed.
function tipCell(e) {
  const box = e.target.closest('.cell');
  const s = box && box.dataset.state;
  return s === 'played' || s === 'missed' ? box : null;
}

function showTooltip(box, x, y) {
  el.tipMatchup.textContent = box.dataset.matchup || '';
  el.tipLine.textContent = box.dataset.line || '';
  show(el.tooltip, true);
  const rect = el.tooltip.getBoundingClientRect();
  tipW = rect.width;
  tipH = rect.height;
  moveTooltip(x, y);
}

function moveTooltip(x, y) {
  const pad = 14;
  let left = x + pad;
  let top = y + pad;
  if (left + tipW > window.innerWidth) left = x - tipW - pad;
  if (top + tipH > window.innerHeight) top = y - tipH - pad;
  el.tooltip.style.left = `${Math.max(4, left)}px`;
  el.tooltip.style.top = `${Math.max(4, top)}px`;
}

function hideTooltip() { show(el.tooltip, false); }

el.grid.addEventListener('mouseover', (e) => {
  const box = tipCell(e);
  if (box) showTooltip(box, e.clientX, e.clientY);
  else hideTooltip();
});
el.grid.addEventListener('mousemove', (e) => {
  const box = tipCell(e);
  if (box) moveTooltip(e.clientX, e.clientY);
  else hideTooltip();
});
el.grid.addEventListener('mouseout', (e) => {
  const to = e.relatedTarget;
  const toCell = to && to.closest ? to.closest('.cell') : null;
  const s = toCell && toCell.dataset.state;
  if (s !== 'played' && s !== 'missed') hideTooltip();
});
el.grid.addEventListener('focusin', (e) => {
  const box = tipCell(e);
  if (box) {
    const r = box.getBoundingClientRect();
    showTooltip(box, r.left, r.bottom);
  }
});
el.grid.addEventListener('focusout', (e) => {
  if (!e.relatedTarget || !el.grid.contains(e.relatedTarget)) hideTooltip();
});
window.addEventListener('scroll', hideTooltip, { passive: true });
