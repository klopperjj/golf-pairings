/**
 * POST /api/admin/event-activate
 *
 * Toggles the `is_active` flag on an event. Only one event can be active at
 * a time (enforced by partial unique index). Optionally archives the
 * previously-active event.
 *
 * Body: {
 *   eventId:   UUID,            // event to activate
 *   archivePrevious?: boolean,  // default true — archive the prior active event
 * }
 */
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

  const { eventId, archivePrevious = true } = req.body || {};
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  try {
    // Step 1: deactivate (and optionally archive) any currently active event
    if (archivePrevious) {
      const { error: e1 } = await supabase
        .from('events')
        .update({ is_active: false, is_archived: true })
        .eq('is_active', true)
        .neq('id', eventId);
      if (e1) throw e1;
    } else {
      const { error: e1 } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('is_active', true)
        .neq('id', eventId);
      if (e1) throw e1;
    }

    // Step 2: activate the target event (and unarchive in case it was archived)
    const { error: e2 } = await supabase
      .from('events')
      .update({ is_active: true, is_archived: false })
      .eq('id', eventId);
    if (e2) throw e2;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Event activate error:', err);
    return res.status(500).json({ error: err.message });
  }
}
