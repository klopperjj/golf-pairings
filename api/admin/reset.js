import jwt from 'jsonwebtoken';
import { getSupabase } from '../_lib/event.js';

const supabase = getSupabase();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No token' });

  let decoded;
  try { decoded = jwt.verify(auth, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  if (!decoded.is_admin) return res.status(403).json({ error: 'Admin only' });
  if (!decoded.event_id) return res.status(400).json({ error: 'Token missing event scope' });
  if (decoded.is_archived) return res.status(403).json({ error: 'Cannot reset an archived event' });

  const { roundDay } = req.body; // 1..N day number, or 'all'
  if (!roundDay) return res.status(400).json({ error: 'roundDay required (number or "all")' });

  try {
    let scoresQuery = supabase.from('scores').delete().eq('event_id', decoded.event_id);
    let approvalsQuery = supabase.from('approvals').delete().eq('event_id', decoded.event_id);

    if (roundDay === 'all') {
      const { error: sErr } = await scoresQuery;
      if (sErr) throw sErr;
      const { error: aErr } = await approvalsQuery;
      if (aErr) throw aErr;
      return res.status(200).json({ ok: true, message: 'All scores and approvals cleared for this event' });
    } else {
      const day = parseInt(roundDay);
      if (!day || day < 1 || day > 5) return res.status(400).json({ error: 'roundDay must be 1-5 or "all"' });
      const { error: sErr } = await scoresQuery.eq('round_day', day);
      if (sErr) throw sErr;
      const { error: aErr } = await approvalsQuery.eq('round_day', day);
      if (aErr) throw aErr;
      return res.status(200).json({ ok: true, message: `Day ${day} scores and approvals cleared` });
    }
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: err.message });
  }
}
