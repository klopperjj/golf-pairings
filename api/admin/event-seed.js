/**
 * POST /api/admin/event-seed
 *
 * Creates a new event with its players and pairings, in one go.
 * Authenticated as an admin player from any existing event (super-admin
 * gating to be added in Phase 3 — for now any admin can create events).
 *
 * Request body:
 * {
 *   adminSecret?: string,            // alternative auth for first-time bootstrap (env ADMIN_SECRET)
 *   slug:        string,             // e.g. "spier-2027"
 *   name:        string,             // "Spier Invitational 2027"
 *   short_name?: string,
 *   start_date:  "YYYY-MM-DD",
 *   end_date:    "YYYY-MM-DD",
 *   course_name?: string,
 *   par_json:    { "1": 4, "2": 4, ... 18 entries },
 *   stroke_index_json: { "1": 3, ... },
 *   team_a_name?: string,            // default "Team A"
 *   team_b_name?: string,            // default "Team B"
 *   team_a_color?: string,           // hex
 *   team_b_color?: string,
 *   day_format_json: { "1": "...", "2": "..." },
 *   hcp_allowance?: number,          // default 85
 *   info_html?: string, rules_md?: string, fines_md?: string,
 *   transport_md?: string, bios_md?: string, itinerary_json?: any,
 *   set_active?: boolean,            // if true, archive others and activate this
 *
 *   players: [
 *     { player_index, name, team: 'A'|'B', mobile, course_hcp, playing_hcp, is_admin?: boolean }
 *   ],
 *   pairings: [
 *     { round_day, tee_time, team: 'A'|'B', player1_index, player2_index }
 *   ]
 * }
 *
 * Default PIN for all seeded players is "1234" — admin should set per-player PINs
 * via the admin PINs tab after seeding.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getSupabase } from '../_lib/event.js';

const supabase = getSupabase();
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-env';
const DEFAULT_PIN = '1234';

function authorize(req) {
  // Allow either an admin JWT or the bootstrap admin secret (for the very first event)
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (auth) {
    try {
      const decoded = jwt.verify(auth, process.env.JWT_SECRET);
      if (decoded.is_admin) return { ok: true, via: 'jwt' };
    } catch { /* fall through */ }
  }
  if (req.body?.adminSecret && req.body.adminSecret === ADMIN_SECRET) {
    return { ok: true, via: 'secret' };
  }
  return { ok: false };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authz = authorize(req);
  if (!authz.ok) return res.status(403).json({ error: 'Forbidden' });

  const body = req.body || {};
  const required = ['slug', 'name', 'start_date', 'end_date', 'par_json', 'stroke_index_json', 'day_format_json', 'players', 'pairings'];
  for (const f of required) {
    if (body[f] == null) return res.status(400).json({ error: `Missing required field: ${f}` });
  }

  if (!Array.isArray(body.players) || body.players.length === 0)
    return res.status(400).json({ error: 'players must be a non-empty array' });
  if (!Array.isArray(body.pairings) || body.pairings.length === 0)
    return res.status(400).json({ error: 'pairings must be a non-empty array' });

  try {
    // 1. Insert event row
    const eventRow = {
      slug: body.slug,
      name: body.name,
      short_name: body.short_name || null,
      start_date: body.start_date,
      end_date: body.end_date,
      course_name: body.course_name || null,
      par_json: body.par_json,
      stroke_index_json: body.stroke_index_json,
      team_a_name: body.team_a_name || 'Team A',
      team_b_name: body.team_b_name || 'Team B',
      team_a_color: body.team_a_color || '#c9a84c',
      team_b_color: body.team_b_color || '#4ecfb0',
      day_format_json: body.day_format_json,
      hcp_allowance: body.hcp_allowance ?? 85,
      info_html: body.info_html || null,
      rules_md: body.rules_md || null,
      fines_md: body.fines_md || null,
      transport_md: body.transport_md || null,
      bios_md: body.bios_md || null,
      itinerary_json: body.itinerary_json || null,
      is_active: false,
      is_archived: false,
    };

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .insert(eventRow)
      .select('id, slug')
      .single();
    if (evErr) throw evErr;

    // 2. Insert players (with hashed default PIN)
    const pin_hash = await bcrypt.hash(DEFAULT_PIN, 10);
    const playerRows = body.players.map(p => ({
      event_id: ev.id,
      player_index: p.player_index,
      name: p.name,
      team: p.team,
      mobile: p.mobile,
      course_hcp: p.course_hcp,
      playing_hcp: p.playing_hcp,
      is_admin: !!p.is_admin,
      pin_hash,
    }));
    const { error: pErr } = await supabase.from('players').insert(playerRows);
    if (pErr) throw pErr;

    // 3. Insert pairings
    const pairingRows = body.pairings.map(p => ({
      event_id: ev.id,
      round_day: p.round_day,
      tee_time: p.tee_time,
      team: p.team,
      player1_index: p.player1_index,
      player2_index: p.player2_index,
    }));
    const { error: paErr } = await supabase.from('pairings').insert(pairingRows);
    if (paErr) throw paErr;

    // 4. Optionally activate (archive any other active first)
    if (body.set_active) {
      const { error: arcErr } = await supabase
        .from('events')
        .update({ is_active: false, is_archived: true })
        .eq('is_active', true)
        .neq('id', ev.id);
      if (arcErr) throw arcErr;
      const { error: actErr } = await supabase.from('events').update({ is_active: true }).eq('id', ev.id);
      if (actErr) throw actErr;
    }

    return res.status(200).json({
      ok: true,
      eventId: ev.id,
      slug: ev.slug,
      players: playerRows.length,
      pairings: pairingRows.length,
      defaultPin: DEFAULT_PIN,
      note: 'Players seeded with default PIN "1234". Set custom PINs in the admin panel before sharing.',
      via: authz.via,
    });
  } catch (err) {
    console.error('Event seed error:', err);
    return res.status(500).json({ error: err.message });
  }
}
