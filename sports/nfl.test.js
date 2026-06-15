import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, teamSchedule, buildNflSlots } from './nfl.js';

test('parseCsv: header + quoted fields with commas', () => {
  const rows = parseCsv('a,b,c\n1,"x,y",3\n4,5,6');
  assert.deepEqual(rows, [{ a: '1', b: 'x,y', c: '3' }, { a: '4', b: '5', c: '6' }]);
});

test('teamSchedule: 2025 REG games for a team, week-ordered, opp/home/completed', () => {
  const rows = [
    { season: '2025', game_type: 'REG', week: '2', home_team: 'DAL', away_team: 'PHI', result: '-3', away_score: '24' },
    { season: '2025', game_type: 'REG', week: '1', home_team: 'PHI', away_team: 'DAL', result: '7', away_score: '20' },
    { season: '2025', game_type: 'REG', week: '3', home_team: 'PHI', away_team: 'KC', result: '', away_score: '' }, // future
    { season: '2024', game_type: 'REG', week: '1', home_team: 'PHI', away_team: 'DAL', result: '1', away_score: '1' }, // wrong season
    { season: '2025', game_type: 'POST', week: '1', home_team: 'PHI', away_team: 'DAL', result: '1', away_score: '1' }, // wrong type
  ];
  assert.deepEqual(teamSchedule(rows, 'PHI'), [
    { week: 1, opp: 'DAL', isHome: true, completed: true },
    { week: 2, opp: 'DAL', isHome: false, completed: true },
    { week: 3, opp: 'KC', isHome: true, completed: false },
  ]);
});

test('buildNflSlots: 4 quarter slots per game; played from worker weeks, else missed/future', () => {
  const schedule = [
    { week: 1, opp: 'DAL', isHome: true, completed: true },
    { week: 2, opp: 'KC', isHome: false, completed: true }, // not in weeks => missed x4
    { week: 3, opp: 'NYG', isHome: true, completed: false }, // future x4
  ];
  const weeks = { '1': { quarters: [14, 79, 18, 41] } };
  const slots = buildNflSlots(schedule, weeks);
  assert.equal(slots.length, 12);
  assert.deepEqual(slots[0], { state: 'played', value: 14, opp: 'DAL', isHome: true, label: 'Q1', week: 1, tooltipLine: 'Q1 · 14 yds' });
  assert.equal(slots[1].value, 79);
  assert.equal(slots[4].state, 'missed');
  assert.equal(slots[8].state, 'future');
});
