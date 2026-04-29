/**
 * ONE-TIME admin seed endpoint.
 * POST /api/admin/seed  { adminSecret: "..." }
 * Creates all 12 players with hashed default PINs.
 * Run once from Postman / curl after deploying.
 * DELETE this file after running!
 */
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'stellenbosch2026admin';

// Default PIN for all players — communicate via WhatsApp before the round
const DEFAULT_PIN = '1234';

const PLAYERS = [
  { player_index: 0,  name: 'Juan Klopper',       team: 'B', course_hcp: 22, playing_hcp: 19, mobile: '0820000001' },
  { player_index: 1,  name: 'Rob Arnold',          team: 'A', course_hcp: 5,  playing_hcp: 4,  mobile: '0820000002' },
  { player_index: 2,  name: 'James Leach',         team: 'B', course_hcp: 2,  playing_hcp: 2,  mobile: '0820000003' },
  { player_index: 3,  name: 'David Harrison',      team: 'B', course_hcp: 11, playing_hcp: 9,  mobile: '0820000004' },
  { player_index: 4,  name: 'Nic Dunn',            team: 'A', course_hcp: 11, playing_hcp: 9,  mobile: '0820000005' },
  { player_index: 5,  name: 'Charles Garner',      team: 'A', course_hcp: 8,  playing_hcp: 7,  mobile: '0820000006' },
  { player_index: 6,  name: 'Ross Andrews',        team: 'B', course_hcp: 11, playing_hcp: 9,  mobile: '0820000007' },
  { player_index: 7,  name: 'Byron Roos',          team: 'B', course_hcp: 20, playing_hcp: 17, mobile: '0820000008' },
  { player_index: 8,  name: 'Shaheed Mohamed',     team: 'A', course_hcp: 20, playing_hcp: 17, mobile: '0820000009' },
  { player_index: 9,  name: 'Jean-Pierre Du Toit', team: 'B', course_hcp: 18, playing_hcp: 15, mobile: '0820000010' },
  { player_index: 10, name: 'Jason Airey',         team: 'A', course_hcp: 9,  playing_hcp: 8,  mobile: '0820000011' },
  { player_index: 11, name: 'Mike Du Toit',        team: 'A', course_hcp: 9,  playing_hcp: 8,  mobile: '0820000012' },
];

const PAIRINGS = [
  { round_day: 1, tee_time: '10:03', team: 'A', player1_index: 1,  player2_index: 4  },
  { round_day: 1, tee_time: '10:03', team: 'B', player1_index: 0,  player2_index: 3  },
  { round_day: 1, tee_time: '10:12', team: 'A', player1_index: 8,  player2_index: 11 },
  { round_day: 1, tee_time: '10:12', team: 'B', player1_index: 2,  player2_index: 7  },
  { round_day: 1, tee_time: '10:21', team: 'A', player1_index: 5,  player2_index: 10 },
  { round_day: 1, tee_time: '10:21', team: 'B', player1_index: 9,  player2_index: 6  },
  { round_day: 2, tee_time: '09:36', team: 'A', player1_index: 1,  player2_index: 11 },
  { round_day: 2, tee_time: '09:36', team: 'B', player1_index: 9,  player2_index: 7  },
  { round_day: 2, tee_time: '09:45', team: 'A', player1_index: 4,  player2_index: 5  },
  { round_day: 2, tee_time: '09:45', team: 'B', player1_index: 3,  player2_index: 2  },
  { round_day: 2, tee_time: '09:54', team: 'A', player1_index: 8,  player2_index: 10 },
  { round_day: 2, tee_time: '09:54', team: 'B', player1_index: 6,  player2_index: 0  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.body?.adminSecret !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });

  try {
    const pin_hash = await bcrypt.hash(DEFAULT_PIN, 10);

    // Upsert players
    const playerRows = PLAYERS.map(p => ({ ...p, pin_hash }));
    const { error: pErr } = await supabase.from('players').upsert(playerRows, { onConflict: 'player_index' });
    if (pErr) throw pErr;

    // Upsert pairings
    const { error: paErr } = await supabase.from('pairings').upsert(PAIRINGS, { onConflict: 'round_day,player1_index' });
    if (paErr) throw paErr;

    return res.status(200).json({ ok: true, players: PLAYERS.length, pairings: PAIRINGS.length, note: 'Default PIN is 1234 for all players' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
