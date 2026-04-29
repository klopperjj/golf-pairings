import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No token' });

  let decoded;
  try {
    decoded = jwt.verify(auth, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (decoded.player_index !== 0) {
    return res.status(403).json({ error: 'Admin access only' });
  }

  const { playerIndex, courseHcp, playingHcp } = req.body;

  if (playerIndex == null || courseHcp == null || playingHcp == null) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (courseHcp < 0 || courseHcp > 54 || playingHcp < 0 || playingHcp > 54) {
    return res.status(400).json({ error: 'Handicap out of range (0–54)' });
  }

  const { error } = await supabase
    .from('players')
    .update({ course_hcp: courseHcp, playing_hcp: playingHcp })
    .eq('player_index', playerIndex);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
