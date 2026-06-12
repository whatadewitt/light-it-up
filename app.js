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
