import { shadeForTotalBases, matchupLabel, normalizeGame } from './lib.js';

const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = 2026;

const el = {
  search: document.getElementById('player-search'),
  suggestions: document.getElementById('suggestions'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error-msg'),
  result: document.getElementById('result'),
  header: document.getElementById('player-header'),
  grid: document.getElementById('grid'),
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

async function loadReferenceData() {
  const [teamsData, playersData] = await Promise.all([
    getJSON(`${API}/teams?sportId=1`),
    getJSON(`${API}/sports/1/players?season=${SEASON}`),
  ]);
  teamAbbrev = {};
  for (const t of teamsData.teams || []) teamAbbrev[t.id] = t.abbreviation;
  players = (playersData.people || []).map((p) => ({
    id: p.id,
    fullName: p.fullName,
    teamId: p.currentTeam && p.currentTeam.id,
  }));
  console.log(`Loaded ${players.length} players, ${Object.keys(teamAbbrev).length} teams`);
}

loadReferenceData().catch((err) => {
  console.error(err);
  showError('Could not load player list. Refresh to try again.');
});

let activeIndex = -1;   // highlighted suggestion
let matches = [];
let currentRequestId = 0;

function renderSuggestions() {
  if (!matches.length) { show(el.suggestions, false); return; }
  el.suggestions.innerHTML = matches
    .map((p, i) => `
      <div class="suggestion-item px-4 py-2 border-b last:border-b-0 ${i === activeIndex ? 'active' : ''}"
           data-i="${i}">
        <span class="font-medium">${p.fullName}</span>
        <span class="text-xs text-gray-500">${teamAbbrev[p.teamId] || ''}</span>
      </div>`)
    .join('');
  show(el.suggestions, true);
  el.suggestions.querySelectorAll('.suggestion-item').forEach((node) => {
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectPlayer(matches[Number(node.dataset.i)]);
    });
  });
}

function updateMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) { matches = []; activeIndex = -1; show(el.suggestions, false); return; }
  matches = players
    .filter((p) => p.fullName.toLowerCase().includes(q))
    .slice(0, 8);
  activeIndex = matches.length ? 0 : -1;
  renderSuggestions();
}

el.search.addEventListener('input', (e) => updateMatches(e.target.value));

el.search.addEventListener('keydown', (e) => {
  if (!matches.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % matches.length; renderSuggestions(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + matches.length) % matches.length; renderSuggestions(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (activeIndex >= 0) selectPlayer(matches[activeIndex]); }
  else if (e.key === 'Escape') { matches = []; activeIndex = -1; show(el.suggestions, false); }
});

document.addEventListener('click', (e) => {
  if (!el.search.contains(e.target) && !el.suggestions.contains(e.target)) {
    show(el.suggestions, false);
  }
});

function selectPlayer(player) {
  el.search.value = player.fullName;
  show(el.suggestions, false);
  matches = [];
  loadPlayer(player);
}

async function loadPlayer(player) {
  const requestId = ++currentRequestId;
  clearError();
  show(el.result, false);
  show(el.loading, true);
  try {
    const url = `${API}/people/${player.id}/stats?stats=gameLog&season=${SEASON}&group=hitting`;
    const data = await getJSON(url);
    if (requestId !== currentRequestId) return;
    const splits = (data.stats && data.stats[0] && data.stats[0].splits) || [];
    if (!splits.length) {
      showError(`No ${SEASON} games for ${player.fullName} yet.`);
      return;
    }
    const games = splits.map((s, i) => normalizeGame(s, teamAbbrev, i));
    renderHeatmap(player, games);
  } catch (err) {
    console.error(err);
    showError('Could not load game log. Please try again.');
  } finally {
    show(el.loading, false);
  }
}

function renderHeatmap(player, games) {
  const teamAbbr = teamAbbrev[player.teamId] || '';
  el.header.innerHTML = `
    <span class="text-lg font-semibold">${player.fullName}</span>
    <span class="text-sm text-gray-500">${teamAbbr} · ${games.length} games</span>`;

  el.grid.innerHTML = '';
  for (const g of games) {
    const box = document.createElement('div');
    box.className = 'cell';
    box.tabIndex = 0;
    box.style.background = shadeForTotalBases(g.totalBases);
    box.dataset.matchup = matchupLabel(g.isHome, g.opp);
    box.dataset.line = g.line;
    el.grid.appendChild(box);
  }
  show(el.result, true);
}

let tipW = 0, tipH = 0;

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
  const pad = 12;
  let left = x + pad;
  let top = y + pad;
  if (left + tipW > window.innerWidth) left = x - tipW - pad;
  if (top + tipH > window.innerHeight) top = y - tipH - pad;
  el.tooltip.style.left = `${Math.max(4, left)}px`;
  el.tooltip.style.top = `${Math.max(4, top)}px`;
}

function hideTooltip() { show(el.tooltip, false); }

el.grid.addEventListener('mouseover', (e) => {
  const box = e.target.closest('.cell');
  if (box) showTooltip(box, e.clientX, e.clientY);
});
el.grid.addEventListener('mousemove', (e) => {
  const box = e.target.closest('.cell');
  if (box) moveTooltip(e.clientX, e.clientY);
});
el.grid.addEventListener('mouseout', (e) => {
  if (e.target.closest('.cell')) hideTooltip();
});
el.grid.addEventListener('focusin', (e) => {
  const box = e.target.closest('.cell');
  if (box) {
    const r = box.getBoundingClientRect();
    showTooltip(box, r.left, r.bottom);
  }
});
el.grid.addEventListener('focusout', (e) => {
  if (!e.relatedTarget || !el.grid.contains(e.relatedTarget)) hideTooltip();
});
