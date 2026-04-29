import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile, pin, deviceFingerprint } = req.body;

  if (!mobile || !pin) {
    return res.status(400).json({ error: 'Mobile number and PIN required' });
  }

  // Normalize mobile: strip spaces, ensure leading 0
  const normalizedMobile = mobile.replace(/\s+/g, '').replace(/^\+27/, '0');

  try {
    // Look up player by mobile
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('mobile', normalizedMobile)
      .single();

    if (error || !player) {
      return res.status(401).json({ error: 'Mobile number not found' });
    }

    // Verify PIN
    const valid = await bcrypt.compare(pin, player.pin_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    // Update device fingerprint if provided (first login from this device)
    if (deviceFingerprint && !player.device_fingerprint) {
      await supabase
        .from('players')
        .update({ device_fingerprint: deviceFingerprint })
        .eq('id', player.id);
    }

    // Sign JWT
    const token = jwt.sign(
      {
        sub: player.id,
        name: player.name,
        team: player.team,
        player_index: player.player_index,
        playing_hcp: player.playing_hcp,
      },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    return res.status(200).json({
      token,
      player: {
        id: player.id,
        name: player.name,
        team: player.team,
        player_index: player.player_index,
        playing_hcp: player.playing_hcp,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
