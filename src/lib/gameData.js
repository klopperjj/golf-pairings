// ── Course Data ──────────────────────────────────────────────────────────────

export const STROKE_INDEX = {
  1: 3,  2: 9,  3: 7,  4: 5,  5: 11, 6: 1,  7: 17, 8: 15, 9: 13,
  10: 6, 11: 10, 12: 18, 13: 16, 14: 12, 15: 8, 16: 2, 17: 14, 18: 4,
};

export const PAR = {
  1: 4, 2: 4, 3: 4, 4: 4, 5: 5, 6: 4, 7: 3, 8: 5, 9: 3,
  10: 4, 11: 4, 12: 4, 13: 5, 14: 3, 15: 5, 16: 3, 17: 4, 18: 4,
};

// ── Players ───────────────────────────────────────────────────────────────────
// team: 'A' = The A Holes (gold), 'B' = The Bum Bandits (teal)

export const PLAYERS = [
  { index: 0,  name: 'Juan Klopper',       team: 'B', courseHcp: 22, playingHcp: 19 },
  { index: 1,  name: 'Rob Arnold',          team: 'A', courseHcp: 5,  playingHcp: 4  },
  { index: 2,  name: 'James Leach',         team: 'B', courseHcp: 2,  playingHcp: 2  },
  { index: 3,  name: 'David Harrison',      team: 'B', courseHcp: 11, playingHcp: 9  },
  { index: 4,  name: 'Nic Dunn',            team: 'A', courseHcp: 11, playingHcp: 9  },
  { index: 5,  name: 'Charles Garner',      team: 'A', courseHcp: 8,  playingHcp: 7  },
  { index: 6,  name: 'Ross Andrews',        team: 'B', courseHcp: 11, playingHcp: 9  },
  { index: 7,  name: 'Byron Roos',          team: 'B', courseHcp: 20, playingHcp: 17 },
  { index: 8,  name: 'Shaheed Mohamed',     team: 'A', courseHcp: 20, playingHcp: 17 },
  { index: 9,  name: 'Jean-Pierre Du Toit', team: 'B', courseHcp: 18, playingHcp: 15 },
  { index: 10, name: 'Jason Airey',         team: 'A', courseHcp: 9,  playingHcp: 8  },
  { index: 11, name: 'Mike Du Toit',        team: 'A', courseHcp: 9,  playingHcp: 8  },
];

// ── Pairings ─────────────────────────────────────────────────────────────────
// Each pairing: { day, teeTime, teamA: [idx, idx], teamB: [idx, idx] }
// teamA = A Holes pair, teamB = Bum Bandits pair

export const PAIRINGS = [
  // Day 1 – Thursday 30 April
  { day: 1, teeTime: '10:03', teamA: [1, 4],  teamB: [0, 3]  }, // Rob & Nic vs Juan & David
  { day: 1, teeTime: '10:12', teamA: [8, 11], teamB: [2, 7]  }, // Shaheed & Mike vs James & Byron
  { day: 1, teeTime: '10:21', teamA: [5, 10], teamB: [9, 6]  }, // Charles & Jason vs JP & Ross
  // Day 2 – Friday 1 May
  { day: 2, teeTime: '09:36', teamA: [1, 11], teamB: [9, 7]  }, // Rob & Mike vs JP & Byron
  { day: 2, teeTime: '09:45', teamA: [4, 5],  teamB: [3, 2]  }, // Nic & Charles vs David & James
  { day: 2, teeTime: '09:54', teamA: [8, 10], teamB: [6, 0]  }, // Shaheed & Jason vs Ross & Juan
];

// Day format labels
export const DAY_FORMAT = {
  1: 'Scramble Drive · Four-Ball Better Ball Stableford',
  2: 'Normal Play · Four-Ball Better Ball Stableford',
};
