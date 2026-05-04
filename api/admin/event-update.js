/**
 * POST /api/admin/event-update
 *
 * Updates an existing event's metadata. Admin-only.
 *
 * Body: {
 *   eventId: UUID,                  // required (which event to update)
 *   updates: {
 *     name?: string, short_name?: string,
 *     start_date?: string, end_date?: string,
 *     course_name?: string,
 *     team_a_name?: string, team_b_name?: string,
 *     team_a_color?: string, team_b_color?: string,
 *     hcp_allowance?: number,
 *     info_html?: string,
 *     rules_md?: string, fines_md?: string, transport_md?: string, bios_md?: string,
 *     itinerary_json?: any,
 *     par_json?: object, stroke_index_json?: object, day_format_json?: object,
 *   }
 * }
 *
 * Note: slug, is_active, is_archived require dedicated endpoints — set-active /
 * archive — to enforce business rules (only one active event at a time).
 */
import jwt from 'jsonwebtoken';
import { getSupabase } from '../_lib/event.js';

const supabase = getSupabase();

const ALLOWED_FIELDS = [
  'name', 'short_name',
  'start_date', 'end_date',
  'course_name',
  'team_a_name', 'team_b_name', 'team_a_color', 'team_b_color',
  'hcp_allowance',
  'info_html',
  'rules_md', 'fines_md', 'transport_md', 'bios_md',
  'itinerary_json',
  'par_json', 'stroke_index_json', 'day_format_json',
  'is_archived',  // archive toggle is a simple flag flip (deactivate uses event-activate)
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) return res.status(401).json({ error: 'No token' });

  let decoded;
  try { decoded = jwt.verify(auth, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  if (!decoded.is_admin) return res.status(403).json({ error: 'Admin only' });

  const { eventId, updates } = req.body || {};
  if (!eventId) return res.status(400).json({ error: 'eventId required' });
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'updates object required' });

  // Whitelist allowed fields only
  const safeUpdate = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in updates) safeUpdate[k] = updates[k];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return res.status(400).json({ error: 'No valid fields in updates' });
  }

  try {
    const { error } = await supabase
      .from('events')
      .update(safeUpdate)
      .eq('id', eventId);
    if (error) throw error;
    return res.status(200).json({ ok: true, updated: Object.keys(safeUpdate) });
  } catch (err) {
    console.error('Event update error:', err);
    return res.status(500).json({ error: err.message });
  }
}
