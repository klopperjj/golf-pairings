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

  const { roundDay } = req.body;
  if (!roundDay) return res.status(400).json({ error: 'roundDay required' });

  try {
    // Find player's tee_time
    const { data: myPairing } = await supabase
      .from('pairings')
      .select('tee_time')
      .eq('round_day', roundDay)
      .or(`player1_index.eq.${user.player_index},player2_index.eq.${user.player_index}`)
      .single();

    if (!myPairing) return res.status(403).json({ error: 'No pairing found' });

    // Insert approval (upsert so double-tapping is safe)
    const { error } = await supabase
      .from('approvals')
      .upsert({
        round_day: roundDay,
        tee_time: myPairing.tee_time,
        player_index: user.player_index,
      }, { onConflict: 'round_day,tee_time,player_index' });

    if (error) throw error;

    // Return full approval status for this group
    const { data: allApprovals } = await supabase
      .from('approvals')
      .select('player_index')
      .eq('round_day', roundDay)
      .eq('tee_time', myPairing.tee_time);

    return res.status(200).json({
      ok: true,
      approvedBy: allApprovals.map(a => a.player_index),
      teeTime: myPairing.tee_time,
    });

  } catch (err) {
    console.error('Approve error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
