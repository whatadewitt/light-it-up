// The SportProvider interface. Each league exports one object with this shape.
// app.js / the board are sport-agnostic and drive everything through the
// currently-selected provider.
//
// @typedef {Object} Slot          One board cell.
//   @property {'played'|'missed'|'future'} state
//   @property {number} [value]     The metric for this box (e.g. total bases). played only.
//   @property {string} [opp]       Opponent abbrev (played/missed).
//   @property {boolean} [isHome]   Home game? (played/missed).
//   @property {string} [tooltipLine] Secondary tooltip text (e.g. batting line). played only.
//   @property {string} [date]      ISO date, if known.
//   @property {string} [label]     Box label for aria/tooltip (e.g. "Game 5", "Q3"). optional.
//
// @typedef {Object} SeasonResult
//   @property {Slot[]} slots        Ordered, one per box, length up to seasonBoxes.
//   @property {boolean} empty        True if the player has no data yet (show empty message).
//
// @typedef {Object} Stat            One nameplate stat.
//   @property {number|string} value
//   @property {string} label
//
// @typedef {Object} SportProvider
//   @property {string} id            'mlb'
//   @property {string} name          'MLB'
//   @property {string} accent        data-league key (theming, Plan 4). 'mlb'
//   @property {number} seasonBoxes   persistent board size (162)
//   @property {string} unit          box granularity label: 'game' | 'quarter'
//   @property {string} metricLabel   'total bases'
//   @property {(value:number)=>number} levelForValue   metric -> ramp level 0-4
//   @property {()=>Promise<Array<{id,fullName,teamId,teamAbbrev}>>} loadPlayers
//   @property {(player)=>Promise<SeasonResult>} loadPlayerSeason
//   @property {(slots:Slot[])=>Stat[]} nameplateStats
//   @property {(slot:Slot, ordinal:number)=>string} boxAria   full aria-label for a played box
export {};
