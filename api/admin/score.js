import jwt from 'jsonwebtoken';
import { getSupabase } from '../_lib/event.js';

const supabase = getSupabase();

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

  if (!decoded.is_admin) return res.status(403).json({ error: 'Admin access only' });
  if (!decoded.event_id) return res.status(400).json({ error: 'Token missing event scope' });
  if (decoded.is_archived) return res.status(403).json({ error: 'Cannot edit scores for an archived event' });

  const { roundDay, holeNumber, playerIndex, grossScore } = req.body;

  if (roundDay == null || holeNumber == null || playerIndex == null || grossScore == null) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (grossScore < 1 || grossScore > 15) {
    return res.status(400).json({ error: 'Score must be 1–15' });
  }

  const { error } = await supabase.from('scores').upsert({
    event_id: decoded.event_id,
    player_index: playerIndex,
    round_day: roundDay,
    hole_number: holeNumber,
    gross_score: grossScore,
    entered_by_index: decoded.player_index,
  }, { onConflict: 'event_id,player_index,round_day,hole_number' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
