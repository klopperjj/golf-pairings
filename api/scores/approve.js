import jwt from 'jsonwebtoken';
import { getSupabase } from '../_lib/event.js';

const supabase = getSupabase();

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
  if (!user.event_id) return res.status(400).json({ error: 'Token missing event scope — please sign in again' });
  if (user.is_archived) return res.status(403).json({ error: 'Cannot approve scorecards for an archived event' });

  const { roundDay } = req.body;
  if (!roundDay) return res.status(400).json({ error: 'roundDay required' });

  try {
    // Find player's tee_time for this event
    const { data: myPairing } = await supabase
      .from('pairings')
      .select('tee_time')
      .eq('event_id', user.event_id)
      .eq('round_day', roundDay)
      .or(`player1_index.eq.${user.player_index},player2_index.eq.${user.player_index}`)
      .single();

    if (!myPairing) return res.status(403).json({ error: 'No pairing found' });

    // Find all 4 players in this fourball
    const { data: fourballRows } = await supabase
      .from('pairings')
      .select('player1_index, player2_index')
      .eq('event_id', user.event_id)
      .eq('round_day', roundDay)
      .eq('tee_time', myPairing.tee_time);

    const fourballIndices = (fourballRows || []).flatMap(r => [r.player1_index, r.player2_index]);
    if (fourballIndices.length !== 4) {
      return res.status(500).json({ error: 'Fourball lookup failed' });
    }

    // Verify all 18 holes entered for all 4 players in this event
    const { data: scoreRows } = await supabase
      .from('scores')
      .select('player_index, hole_number')
      .eq('event_id', user.event_id)
      .eq('round_day', roundDay)
      .in('player_index', fourballIndices);

    const expectedCount = 18 * 4;
    if (!scoreRows || scoreRows.length < expectedCount) {
      return res.status(400).json({
        error: `Cannot approve: only ${scoreRows?.length ?? 0}/${expectedCount} scores entered. Complete all 18 holes for all 4 players first.`,
      });
    }

    // Insert approval (upsert so double-tapping is safe)
    const { error } = await supabase
      .from('approvals')
      .upsert({
        event_id: user.event_id,
        round_day: roundDay,
        tee_time: myPairing.tee_time,
        player_index: user.player_index,
      }, { onConflict: 'event_id,round_day,tee_time,player_index' });

    if (error) throw error;

    // Return full approval status for this group
    const { data: allApprovals } = await supabase
      .from('approvals')
      .select('player_index')
      .eq('event_id', user.event_id)
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
