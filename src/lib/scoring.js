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

/**
 * Four-Ball Better-Ball Match Play within one fourball.
 * Each hole, the pair with the higher better-ball Stableford pts wins the hole.
 * Equal = halved.
 *
 * Returns { holes: [{ hole, teamAPts, teamBPts, winner: 'A'|'B'|'H'|null, teamAHolesUp }],
 *           teamAHolesUp, holesPlayed, holesRemaining, status }
 *   status:
 *     - 'in-progress'  → both teams still in it
 *     - 'closed'       → match decided early (lead > holes remaining)
 *     - 'final'        → 18 holes played
 *     - 'dormie'       → lead == holes remaining (in progress, but losing team can only halve)
 */
export function computeFourBallMatchPlay(teamAScores, teamBScores, teamAHcps, teamBHcps) {
  let teamAHolesUp = 0;
  let holesPlayed = 0;
  const holes = [];

  for (let h = 1; h <= 18; h++) {
    const [hcp1A, hcp2A] = teamAHcps;
    const [hcp1B, hcp2B] = teamBHcps;

    const g1A = teamAScores[0]?.[h];
    const g2A = teamAScores[1]?.[h];
    const g1B = teamBScores[0]?.[h];
    const g2B = teamBScores[1]?.[h];

    // Both teams need at least one score entered to score the hole
    const aHasScore = g1A != null || g2A != null;
    const bHasScore = g1B != null || g2B != null;
    if (!aHasScore || !bHasScore) {
      holes.push({ hole: h, teamAPts: null, teamBPts: null, winner: null, teamAHolesUp });
      continue;
    }

    const teamAPts = betterBallPoints(hcp1A, g1A, hcp2A, g2A, h);
    const teamBPts = betterBallPoints(hcp1B, g1B, hcp2B, g2B, h);

    let winner = 'H';
    if (teamAPts > teamBPts) { winner = 'A'; teamAHolesUp++; }
    else if (teamBPts > teamAPts) { winner = 'B'; teamAHolesUp--; }

    holesPlayed++;
    holes.push({ hole: h, teamAPts, teamBPts, winner, teamAHolesUp });
  }

  const holesRemaining = 18 - holesPlayed;
  const lead = Math.abs(teamAHolesUp);
  let status = 'in-progress';
  if (holesPlayed === 18) status = 'final';
  else if (lead > holesRemaining) status = 'closed';
  else if (lead === holesRemaining && lead > 0) status = 'dormie';

  return { holes, teamAHolesUp, holesPlayed, holesRemaining, status };
}

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
