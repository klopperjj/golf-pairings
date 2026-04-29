-- ── Approvals table ──────────────────────────────────────────────────
-- One row per player per round per group (identified by tee_time).
-- Scorecard is "final" when at least one player from each team has approved.

CREATE TABLE IF NOT EXISTS approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_day     INTEGER NOT NULL CHECK (round_day IN (1, 2)),
  tee_time      TEXT NOT NULL,
  player_index  INTEGER NOT NULL REFERENCES players(player_index),
  approved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_day, tee_time, player_index)
);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

-- Anyone can read (so all players can see approval status)
CREATE POLICY "approvals_read" ON approvals FOR SELECT USING (true);

-- Only service role can insert/update (via API functions)
