import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });

  const { roundDay, holeNumber, scores } = req.body;
  // scores: [{ playerIndex, grossScore }, ...]  — one or two entries (the pair)

  if (!roundDay || !holeNumber || !scores || !Array.isArray(scores)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  if (holeNumber < 1 || holeNumber > 18) {
    return res.status(400).json({ error: 'Invalid hole number' });
  }

  try {
    // Verify the submitting user is authorised to enter scores for these players
    // (they must be in the same pairing group on that day)
    const { data: pairing } = await supabase
      .from('pairings')
      .select('player1_index, player2_index')
      .eq('round_day', roundDay)
      .or(`player1_index.eq.${user.player_index},player2_index.eq.${user.player_index}`)
      .single();

    if (!pairing) {
      return res.status(403).json({ error: 'No pairing found for this round' });
    }

    const allowedIndices = [pairing.player1_index, pairing.player2_index];

    // Check all submitted scores are for allowed players
    for (const { playerIndex } of scores) {
      if (!allowedIndices.includes(playerIndex)) {
        return res.status(403).json({
          error: `Not authorised to enter scores for player ${playerIndex}`,
        });
      }
    }

    // Upsert scores
    const rows = scores
      .filter(s => s.grossScore != null && s.grossScore > 0)
      .map(({ playerIndex, grossScore }) => ({
        player_index: playerIndex,
        round_day: roundDay,
        hole_number: holeNumber,
        gross_score: grossScore,
        entered_by_index: user.player_index,
      }));

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No valid scores provided' });
    }

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
