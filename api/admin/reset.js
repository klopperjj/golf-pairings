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
  try { decoded = jwt.verify(auth, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  if (decoded.player_index !== 0) return res.status(403).json({ error: 'Admin only' });

  const { roundDay } = req.body; // 1, 2, or 'all'
  if (!roundDay) return res.status(400).json({ error: 'roundDay required (1, 2, or "all")' });

  try {
    if (roundDay === 'all') {
      // Delete all scores and approvals across both days
      const { error: sErr } = await supabase.from('scores').delete().in('round_day', [1, 2]);
      if (sErr) throw sErr;
      const { error: aErr } = await supabase.from('approvals').delete().in('round_day', [1, 2]);
      if (aErr) throw aErr;
      return res.status(200).json({ ok: true, message: 'All scores and approvals cleared' });
    } else {
      const day = parseInt(roundDay);
      if (day !== 1 && day !== 2) return res.status(400).json({ error: 'roundDay must be 1, 2, or "all"' });
      const { error: sErr } = await supabase.from('scores').delete().eq('round_day', day);
      if (sErr) throw sErr;
      const { error: aErr } = await supabase.from('approvals').delete().eq('round_day', day);
      if (aErr) throw aErr;
      return res.status(200).json({ ok: true, message: `Day ${day} scores and approvals cleared` });
    }
  } catch (err) {
    console.error('Reset error:', err);
    return res.status(500).json({ error: err.message });
  }
}
