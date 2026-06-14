import { levelForTotalBases, matchupLabel, normalizeGame } from './lib.js';

const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = 2026;
const SEASON_GAMES = 162;      // full regular season — the board is always this many slots
const MAX_SUGGESTIONS = 8;
const REVEAL_STEP_MS = 4;      // per-cell stagger
const REVEAL_CAP_MS = 640;     // never take longer than this to light all 162
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

let teamAbbrev = {};   // id -> "NYY"
let players = [];      // [{ id, fullName, teamId }]

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
ensureBoard(SEASON_GAMES);

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
    const bases = slot.totalBases === 1 ? '1 total base' : `${slot.totalBases} total bases`;
    c.dataset.state = 'played';
    c.dataset.level = String(levelForTotalBases(slot.totalBases));
    c.dataset.matchup = matchup;
    c.dataset.line = slot.line;
    c.tabIndex = 0;
    c.removeAttribute('aria-hidden');
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `Game ${ordinal}, ${matchup}: ${bases}. ${slot.line}`);
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
  ensureBoard(Math.max(SEASON_GAMES, slots.length));
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

// Build one slot per team game from the schedule, dropping the player's played
// games into their real calendar positions (matched by gamePk). Returns how many
// distinct played games were placed, so the caller can detect a mid-season trade
// (some played games belong to another team's schedule) and fall back safely.
function buildSlots(sched, teamId, playedByPk) {
  // Dedupe by gamePk: the API can list a suspended/resumed game twice.
  const seen = new Set();
  const games = [];
  for (const d of sched.dates || []) {
    for (const g of d.games || []) {
      if (g.gamePk == null || seen.has(g.gamePk)) continue;
      seen.add(g.gamePk);
      games.push(g);
    }
  }
  const placed = new Set();
  const slots = games.map((g) => {
    const split = playedByPk.get(g.gamePk);
    if (split) {
      placed.add(g.gamePk);
      return { state: 'played', ...normalizeGame(split, teamAbbrev, 0) };
    }
    const status = g.status || {};
    const isFinal = status.abstractGameState === 'Final' || status.codedGameState === 'F';
    const dead = /Cancelled|Postponed|Suspended/i.test(status.detailedState || '');
    const home = g.teams && g.teams.home && g.teams.home.team;
    const away = g.teams && g.teams.away && g.teams.away.team;
    const isHome = !!(home && home.id === teamId);
    const oppTeam = isHome ? away : home;
    const oppId = oppTeam && oppTeam.id;
    const opp = teamAbbrev[oppId] || (oppTeam && oppTeam.name) || '???';
    if (isFinal && !dead) return { state: 'missed', isHome, opp };
    return { state: 'future', isHome, opp };
  });
  return { slots, placed: placed.size };
}

async function loadReferenceData() {
  const [teamsData, playersData] = await Promise.all([
    getJSON(`${API}/teams?sportId=1`),
    getJSON(`${API}/sports/1/players?season=${SEASON}`),
  ]);
  teamAbbrev = {};
  for (const t of teamsData.teams || []) teamAbbrev[t.id] = t.abbreviation;
  players = (playersData.people || [])
    // This is a hitting tool — drop pitchers, but keep two-way players (e.g. Ohtani).
    .filter((p) => !p.primaryPosition || p.primaryPosition.type !== 'Pitcher')
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      teamId: p.currentTeam && p.currentTeam.id,
    }));
}

loadReferenceData().catch((err) => {
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
        <span class="suggestion__team">${escapeHtml(teamAbbrev[p.teamId] || '')}</span>
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
  const teamAbbr = teamAbbrev[player.teamId] || '';
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">
      <span class="nameplate__loading">${teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}Loading season…</span>
    </div>`;
}

function renderNameplate(player, playedGames) {
  const teamAbbr = teamAbbrev[player.teamId] || '';
  const totalTB = playedGames.reduce((sum, g) => sum + g.totalBases, 0);
  const best = playedGames.reduce((m, g) => Math.max(m, g.totalBases), 0);
  el.nameplate.innerHTML = `
    <h2 class="nameplate__name">${escapeHtml(player.fullName)}</h2>
    <div class="nameplate__stats">
      <div class="stat"><span class="stat__value">${playedGames.length}</span><span class="stat__label">${teamAbbr ? escapeHtml(teamAbbr) + ' · ' : ''}Games</span></div>
      <div class="stat"><span class="stat__value">${totalTB}</span><span class="stat__label">Total Bases</span></div>
      <div class="stat"><span class="stat__value">${best}</span><span class="stat__label">Best Game</span></div>
    </div>`;
}

async function loadPlayer(player) {
  const requestId = ++currentRequestId;
  clearError();
  show(el.nameplate, true);
  renderNameplateLoading(player);
  hideTooltip();
  fadeBoardOff();

  const logUrl = `${API}/people/${player.id}/stats?stats=gameLog&season=${SEASON}&group=hitting`;
  const schedUrl = player.teamId
    ? `${API}/schedule?sportId=1&season=${SEASON}&teamId=${player.teamId}&gameType=R`
    : null;

  try {
    // Game log is required; the schedule is best-effort (used to place games on the
    // team's calendar and reveal missed stretches). A schedule failure is non-fatal.
    const [data, sched] = await Promise.all([
      getJSON(logUrl),
      schedUrl ? getJSON(schedUrl).catch(() => null) : Promise.resolve(null),
    ]);
    if (requestId !== currentRequestId) return;

    const splits = (data.stats && data.stats[0] && data.stats[0].splits) || [];
    if (!splits.length) {
      show(el.nameplate, false);
      show(el.legend, false);
      showError(`No 2026 games for ${player.fullName} yet — check back after Opening Day.`);
      return;
    }

    // Index the played games by gamePk so they can be placed on the team's schedule.
    const playedByPk = new Map();
    for (const s of splits) {
      const pk = s.game && s.game.gamePk;
      if (pk != null) playedByPk.set(pk, s);
    }

    let slots;
    if (sched && sched.dates) {
      const built = buildSlots(sched, player.teamId, playedByPk);
      // Use the calendar-aligned layout only if every played game found a home on this
      // team's schedule. If some didn't (e.g. a mid-season trade pulls in another team's
      // games), fall back to a simple chronological layout so no games are lost.
      slots = built.placed === playedByPk.size
        ? built.slots
        : splits.map((s) => ({ state: 'played', ...normalizeGame(s, teamAbbrev, 0) }));
    } else {
      slots = splits.map((s) => ({ state: 'played', ...normalizeGame(s, teamAbbrev, 0) }));
    }

    const playedGames = slots.filter((s) => s.state === 'played');
    const teamGamesSoFar = slots.filter((s) => s.state !== 'future').length || playedGames.length;

    const elapsed = (typeof performance !== 'undefined' ? performance.now() : MIN_FADE_MS) - fadeStart;
    const wait = Math.max(0, MIN_FADE_MS - elapsed);

    const apply = () => {
      if (requestId !== currentRequestId) return;
      renderNameplate(player, playedGames);
      show(el.legend, true);
      el.grid.setAttribute('aria-label',
        `${player.fullName}'s 2026 season — played ${playedGames.length} of the team's ${teamGamesSoFar} games so far, total bases per game`);
      el.status.textContent =
        `${player.fullName}: played ${playedGames.length} of the team's ${teamGamesSoFar} games so far in 2026.`;
      lightUpBoard(slots, requestId);
    };
    if (wait > 0) setTimeout(apply, wait); else apply();
  } catch (err) {
    if (requestId !== currentRequestId) return;
    console.error(err);
    show(el.nameplate, false);
    show(el.legend, false);
    showError('Could not load that game log. Please try again.');
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
