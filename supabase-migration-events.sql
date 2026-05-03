-- ═══════════════════════════════════════════════════════════════════
-- Multi-Event Migration · golf-pairings
-- Adds events table, scopes existing data to a Stellenbosch event,
-- and re-bases unique constraints to (event_id, ...).
--
-- ⚠️  BEFORE RUNNING:
--    1. Take a Supabase backup snapshot (Dashboard → Database → Backups)
--    2. Make sure no one is actively entering scores
--    3. Run this entire file as one transaction in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Events table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  short_name         TEXT,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  course_name        TEXT,
  par_json           JSONB NOT NULL,
  stroke_index_json  JSONB NOT NULL,
  team_a_name        TEXT NOT NULL DEFAULT 'Team A',
  team_b_name        TEXT NOT NULL DEFAULT 'Team B',
  team_a_color       TEXT NOT NULL DEFAULT '#c9a84c',
  team_b_color       TEXT NOT NULL DEFAULT '#4ecfb0',
  day_format_json    JSONB NOT NULL,
  hcp_allowance      INT  NOT NULL DEFAULT 85,
  info_html          TEXT,
  rules_md           TEXT,
  fines_md           TEXT,
  transport_md       TEXT,
  bios_md            TEXT,
  itinerary_json     JSONB,
  is_active          BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active event at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_active_event
  ON events ((is_active)) WHERE is_active = TRUE;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_read ON events;
CREATE POLICY events_read ON events FOR SELECT USING (true);

-- ── 2. Add event_id columns (nullable for now) + admin flag ─────────
ALTER TABLE players   ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);
ALTER TABLE players   ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pairings  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);
ALTER TABLE scores    ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);

-- ── 3. Insert the Stellenbosch event ────────────────────────────────
INSERT INTO events (
  slug, name, short_name, start_date, end_date, course_name,
  par_json, stroke_index_json,
  team_a_name, team_b_name, team_a_color, team_b_color,
  day_format_json, hcp_allowance, is_active
) VALUES (
  'stellenbosch-2026',
  'Stellenbosch Invitational 2026',
  'SFGC 2026',
  '2026-04-30',
  '2026-05-01',
  'Stellenbosch Golf Club',
  '{"1":4,"2":4,"3":4,"4":4,"5":5,"6":4,"7":3,"8":5,"9":3,"10":4,"11":4,"12":5,"13":3,"14":5,"15":3,"16":4,"17":4,"18":4}'::jsonb,
  '{"1":3,"2":9,"3":7,"4":5,"5":11,"6":1,"7":17,"8":15,"9":13,"10":6,"11":10,"12":18,"13":16,"14":12,"15":8,"16":2,"17":14,"18":4}'::jsonb,
  'A Holes',
  'Bum Bandits',
  '#c9a84c',
  '#4ecfb0',
  '{"1":"Scramble Drive · Four-Ball Better Ball Stableford","2":"Normal Play · Four-Ball Better Ball Stableford"}'::jsonb,
  85,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. Backfill existing rows with the Stellenbosch event_id ────────
UPDATE players   SET event_id = (SELECT id FROM events WHERE slug = 'stellenbosch-2026')
  WHERE event_id IS NULL;
UPDATE pairings  SET event_id = (SELECT id FROM events WHERE slug = 'stellenbosch-2026')
  WHERE event_id IS NULL;
UPDATE scores    SET event_id = (SELECT id FROM events WHERE slug = 'stellenbosch-2026')
  WHERE event_id IS NULL;
UPDATE approvals SET event_id = (SELECT id FROM events WHERE slug = 'stellenbosch-2026')
  WHERE event_id IS NULL;

-- Promote Juan (player_index 0) to admin for Stellenbosch
UPDATE players SET is_admin = TRUE WHERE player_index = 0;

-- ── 5. Now that data is backfilled, enforce NOT NULL ────────────────
ALTER TABLE players   ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE pairings  ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE scores    ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE approvals ALTER COLUMN event_id SET NOT NULL;

-- ── 6. Re-scope unique constraints to be event-scoped ───────────────
-- Players
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_player_index_key;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_mobile_key;
CREATE UNIQUE INDEX IF NOT EXISTS players_event_idx_uniq    ON players(event_id, player_index);
CREATE UNIQUE INDEX IF NOT EXISTS players_event_mobile_uniq ON players(event_id, mobile);

-- Pairings
ALTER TABLE pairings DROP CONSTRAINT IF EXISTS pairings_round_day_player1_index_key;
ALTER TABLE pairings DROP CONSTRAINT IF EXISTS pairings_round_day_player2_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS pairings_event_day_p1 ON pairings(event_id, round_day, player1_index);
CREATE UNIQUE INDEX IF NOT EXISTS pairings_event_day_p2 ON pairings(event_id, round_day, player2_index);

-- Scores
ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_player_index_round_day_hole_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS scores_event_player_day_hole
  ON scores(event_id, player_index, round_day, hole_number);

-- Approvals
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_round_day_tee_time_player_index_key;
CREATE UNIQUE INDEX IF NOT EXISTS approvals_event_day_tee_player
  ON approvals(event_id, round_day, tee_time, player_index);

-- ── 7. Relax round_day check to support 1-5 day events ─────────────
ALTER TABLE scores    DROP CONSTRAINT IF EXISTS scores_round_day_check;
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_round_day_check;
ALTER TABLE pairings  DROP CONSTRAINT IF EXISTS pairings_round_day_check;
ALTER TABLE scores    ADD CONSTRAINT scores_round_day_chk    CHECK (round_day BETWEEN 1 AND 5);
ALTER TABLE approvals ADD CONSTRAINT approvals_round_day_chk CHECK (round_day BETWEEN 1 AND 5);
ALTER TABLE pairings  ADD CONSTRAINT pairings_round_day_chk  CHECK (round_day BETWEEN 1 AND 5);

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION (run separately, outside the transaction)
-- ═══════════════════════════════════════════════════════════════════
-- SELECT count(*) AS events FROM events;                       -- expect 1
-- SELECT slug, name, is_active FROM events;                    -- stellenbosch-2026, true
-- SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphans FROM players;    -- expect 0
-- SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphans FROM scores;     -- expect 0
-- SELECT count(*) FILTER (WHERE is_admin) AS admins FROM players;             -- expect 1
-- SELECT player_index, name, is_admin FROM players ORDER BY player_index;
