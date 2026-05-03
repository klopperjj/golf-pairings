import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSupabase, findEventBySlug, resolveActiveEventId } from '../_lib/event.js';

const supabase = getSupabase();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mobile, pin, deviceFingerprint, eventSlug } = req.body;

  if (!mobile || !pin) {
    return res.status(400).json({ error: 'Mobile number and PIN required' });
  }

  // Resolve target event: explicit slug wins; otherwise active event
  let targetEvent;
  if (eventSlug) {
    targetEvent = await findEventBySlug(supabase, eventSlug);
    if (!targetEvent) return res.status(404).json({ error: `Event '${eventSlug}' not found` });
  } else {
    const { eventId, isArchived } = await resolveActiveEventId(supabase);
    if (!eventId) return res.status(503).json({ error: 'No active event configured' });
    targetEvent = { id: eventId, slug: null, is_archived: isArchived };
  }

  // Normalize mobile: strip spaces, ensure leading 0
  const normalizedMobile = mobile.replace(/\s+/g, '').replace(/^\+27/, '0');

  try {
    // Look up player by (event_id, mobile)
    const { data: player, error } = await supabase
      .from('players')
      .select('*')
      .eq('event_id', targetEvent.id)
      .eq('mobile', normalizedMobile)
      .single();

    if (error || !player) {
      return res.status(401).json({ error: 'Mobile number not found for this event' });
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

    // Sign JWT — includes event scope + admin flag
    const token = jwt.sign(
      {
        sub: player.id,
        name: player.name,
        team: player.team,
        player_index: player.player_index,
        playing_hcp: player.playing_hcp,
        event_id: targetEvent.id,
        event_slug: targetEvent.slug,
        is_admin: !!player.is_admin,
        is_archived: !!targetEvent.is_archived,
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
        is_admin: !!player.is_admin,
        event_id: targetEvent.id,
        event_slug: targetEvent.slug,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
