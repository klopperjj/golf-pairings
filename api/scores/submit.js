import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.slice(7), process.env.JWT_SECRET); }
  catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });

  const { roundDay, holeNumber, scores } = req.body;

  if (!roundDay || !holeNumber || !Array.isArray(scores) || scores.length === 0)
    return res.status(400).json({ error: 'Invalid payload' });
  if (holeNumber < 1 || holeNumber > 18)
    return res.status(400).json({ error: 'Invalid hole number' });

  try {
    // Find the submitting player's pairing to get their tee_time
    const { data: myPairing } = await supabase
      .from('pairings')
      .select('tee_time')
      .eq('round_day', roundDay)
      .or(`player1_index.eq.${user.player_index},player2_index.eq.${user.player_index}`)
      .single();

    if (!myPairing) return res.status(403).json({ error: 'No pairing found for this round' });

    // Get ALL four players in this fourball (both pairings at same tee_time)
    const { data: groupPairings } = await supabase
      .from('pairings')
      .select('player1_index, player2_index')
      .eq('round_day', roundDay)
      .eq('tee_time', myPairing.tee_time);

    const fourbAllIndices = groupPairings.flatMap(p => [p.player1_index, p.player2_index]);

    // Validate all submitted scores belong to players in this fourball
    for (const { playerIndex } of scores) {
      if (!fourbAllIndices.includes(playerIndex))
        return res.status(403).json({ error: `Player ${playerIndex} is not in your fourball` });
    }

    // Upsert scores
    const rows = scores
      .filter(s => s.grossScore != null && s.grossScore >= 1 && s.grossScore <= 15)
      .map(({ playerIndex, grossScore }) => ({
        player_index: playerIndex,
        round_day: roundDay,
        hole_number: holeNumber,
        gross_score: grossScore,
        entered_by_index: user.player_index,
      }));

    if (rows.length === 0) return res.status(400).json({ error: 'No valid scores' });

    const { error } = await supabase
      .from('scores')
      .upsert(rows, { onConflict: 'player_index,round_day,hole_number' });

    if (error) throw error;
    return res.status(200).json({ ok: true, saved: rows.length });

  } catch (err) {
    console.error('Score submit error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
