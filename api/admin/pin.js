import bcrypt from 'bcryptjs';
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

  const { playerIndex, newPin, mobile } = req.body;
  if (playerIndex === undefined || playerIndex === null) {
    return res.status(400).json({ error: 'playerIndex required' });
  }

  const update = {};

  if (newPin !== undefined && newPin !== null && newPin !== '') {
    if (!/^\d{4}$/.test(String(newPin))) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    update.pin_hash = await bcrypt.hash(String(newPin), 10);
  }

  if (mobile !== undefined && mobile !== null && mobile !== '') {
    const normalized = String(mobile).replace(/\s+/g, '').replace(/^\+27/, '0');
    if (!/^0\d{9}$/.test(normalized)) {
      return res.status(400).json({ error: 'Mobile must be 10 digits starting with 0 (e.g. 0821234567)' });
    }
    update.mobile = normalized;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'Provide newPin and/or mobile to update' });
  }

  try {
    const { error } = await supabase
      .from('players')
      .update(update)
      .eq('event_id', decoded.event_id)
      .eq('player_index', playerIndex);
    if (error) throw error;

    // Also clear device fingerprint when PIN changes so player re-binds on next login
    if (update.pin_hash) {
      await supabase.from('players')
        .update({ device_fingerprint: null })
        .eq('event_id', decoded.event_id)
        .eq('player_index', playerIndex);
    }

    return res.status(200).json({ ok: true, updated: Object.keys(update) });
  } catch (err) {
    console.error('Admin pin error:', err);
    return res.status(500).json({ error: err.message });
  }
}
