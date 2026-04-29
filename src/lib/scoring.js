import { STROKE_INDEX, PAR } from './gameData.js';

/** How many strokes a player receives on a specific hole */
export function strokesOnHole(playingHandicap, holeNumber) {
  const si = STROKE_INDEX[holeNumber];
  const full = Math.floor(playingHandicap / 18);
  const remainder = playingHandicap % 18;
  return full + (si <= remainder ? 1 : 0);
}

/** Net score for a player on a hole */
export function netScore(gross, playingHandicap, holeNumber) {
  return gross - strokesOnHole(playingHandicap, holeNumber);
}

/** Stableford points for a player on a hole */
export function stablefordPoints(gross, playingHandicap, holeNumber) {
  const par = PAR[holeNumber];
  const net = netScore(gross, playingHandicap, holeNumber);
  return Math.max(0, 2 + (par - net));
}

/**
 * Given a pair of players and their gross scores for a hole,
 * returns the better-ball Stableford points for the pair.
 */
export function betterBallPoints(player1Hcp, gross1, player2Hcp, gross2, holeNumber) {
  const pts1 = gross1 != null ? stablefordPoints(gross1, player1Hcp, holeNumber) : 0;
  const pts2 = gross2 != null ? stablefordPoints(gross2, player2Hcp, holeNumber) : 0;
  return Math.max(pts1, pts2);
}

/**
 * For each hole 1-18, compute Four-Ball Better Ball Stableford for one group.
 * Returns array of { hole, teamAPts, teamBPts } (better-ball pts per team per hole)
 * plus cumulative totals { teamATotal, teamBTotal }
 */
export function computeFourBallStableford(teamAScores, teamBScores, teamAHcps, teamBHcps) {
  let teamATotal = 0;
  let teamBTotal = 0;
  const holes = [];

  for (let h = 1; h <= 18; h++) {
    const [hcp1A, hcp2A] = teamAHcps;
    const [hcp1B, hcp2B] = teamBHcps;

    const gross1A = teamAScores[0]?.[h];
    const gross2A = teamAScores[1]?.[h];
    const gross1B = teamBScores[0]?.[h];
    const gross2B = teamBScores[1]?.[h];

    // Skip if no scores entered for this hole
    if (gross1A == null && gross2A == null && gross1B == null && gross2B == null) {
      holes.push({ hole: h, teamAPts: null, teamBPts: null });
      continue;
    }

    const teamAPts = betterBallPoints(hcp1A, gross1A, hcp2A, gross2A, h);
    const teamBPts = betterBallPoints(hcp1B, gross1B, hcp2B, gross2B, h);

    teamATotal += teamAPts;
    teamBTotal += teamBPts;

    holes.push({ hole: h, teamAPts, teamBPts });
  }

  return { holes, teamATotal, teamBTotal };
}

// Keep old name as alias for any legacy callers
export const computeFourBallMatch = computeFourBallStableford;

/** Build a lookup: playerIndex → { [hole]: grossScore } from Supabase scores rows */
export function buildScoreLookup(scoresRows) {
  const lookup = {};
  for (const row of scoresRows) {
    if (!lookup[row.player_index]) lookup[row.player_index] = {};
    lookup[row.player_index][row.hole_number] = row.gross_score;
  }
  return lookup;
}

/** Total Stableford points for a player across all entered holes */
export function playerTotalPoints(playerIndex, playingHcp, scoreLookup) {
  const scores = scoreLookup[playerIndex] || {};
  return Object.entries(scores).reduce((sum, [hole, gross]) => {
    return sum + stablefordPoints(gross, playingHcp, Number(hole));
  }, 0);
}
