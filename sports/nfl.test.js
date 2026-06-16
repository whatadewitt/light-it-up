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

test('buildNflSlots QB: value=pass+rush, level honors QB_THRESHOLDS, tooltipLine', () => {
  const schedule = [
    { week: 1, opp: 'DAL', isHome: true, completed: true },
  ];
  // pass[0]=80, rush[0]=10 => Q1 value=90 > 89 => level 4
  // remaining quarters: value=0, level=0
  const weeks = { '1': { pass: [80, 0, 0, 0], rush: [10, 0, 0, 0], rec: [0, 0, 0, 0] } };
  const slots = buildNflSlots(schedule, weeks, 'qb');
  assert.equal(slots.length, 4);
  assert.equal(slots[0].state, 'played');
  assert.equal(slots[0].value, 90);
  assert.equal(slots[0].level, 4);
  assert.equal(slots[0].posGroup, 'qb');
  assert.equal(slots[0].tooltipLine, 'Q1 · 80 pass, 10 rush');
  assert.equal(slots[1].value, 0);
  assert.equal(slots[1].level, 0);
});

test('buildNflSlots skill: value=rush+rec, level honors SKILL_THRESHOLDS, tooltipLine', () => {
  const schedule = [
    { week: 1, opp: 'KC', isHome: false, completed: true },
  ];
  // rush[0]=20, rec[0]=15 => Q1 value=35; 29 < 35 <= 49 => level 3
  const weeks = { '1': { pass: [0, 0, 0, 0], rush: [20, 0, 0, 0], rec: [15, 0, 0, 0] } };
  const slots = buildNflSlots(schedule, weeks, 'skill');
  assert.equal(slots[0].state, 'played');
  assert.equal(slots[0].value, 35);
  assert.equal(slots[0].level, 3);
  assert.equal(slots[0].posGroup, 'skill');
  assert.equal(slots[0].tooltipLine, 'Q1 · 20 rush, 15 rec');
});

test('buildNflSlots: missed and future carry posGroup', () => {
  const schedule = [
    { week: 1, opp: 'DAL', isHome: true, completed: true },  // played
    { week: 2, opp: 'KC',  isHome: false, completed: true },  // missed (not in weeks)
    { week: 3, opp: 'NYG', isHome: true,  completed: false }, // future
  ];
  const weeks = { '1': { pass: [0, 0, 0, 0], rush: [10, 0, 0, 0], rec: [5, 0, 0, 0] } };
  const slots = buildNflSlots(schedule, weeks, 'skill');
  assert.equal(slots.length, 12);
  assert.equal(slots[0].state, 'played');
  assert.equal(slots[0].posGroup, 'skill');
  assert.equal(slots[4].state, 'missed');
  assert.equal(slots[4].posGroup, 'skill');
  assert.equal(slots[8].state, 'future');
  assert.equal(slots[8].posGroup, 'skill');
});
