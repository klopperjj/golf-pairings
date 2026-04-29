-- ═══════════════════════════════════════════════════════════════════
-- Stellenbosch Invitational 2026 — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════

-- Players (pre-seeded via /api/admin/seed after first deploy)
CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_index    INTEGER UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  mobile          TEXT UNIQUE NOT NULL,
  pin_hash        TEXT NOT NULL,
  team            TEXT NOT NULL CHECK (team IN ('A', 'B')),
  course_hcp      INTEGER NOT NULL,
  playing_hcp     INTEGER NOT NULL,
  device_fingerprint TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pairings per round day
CREATE TABLE IF NOT EXISTS pairings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_day       INTEGER NOT NULL CHECK (round_day IN (1, 2)),
  tee_time        TEXT NOT NULL,
  team            TEXT NOT NULL CHECK (team IN ('A', 'B')),
  player1_index   INTEGER NOT NULL REFERENCES players(player_index),
  player2_index   INTEGER NOT NULL REFERENCES players(player_index),
  UNIQUE(round_day, player1_index),
  UNIQUE(round_day, player2_index)
);

-- Scores (one row per player per hole per round day)
CREATE TABLE IF NOT EXISTS scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_index    INTEGER NOT NULL REFERENCES players(player_index),
  round_day       INTEGER NOT NULL CHECK (round_day IN (1, 2)),
  hole_number     INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  gross_score     INTEGER NOT NULL CHECK (gross_score BETWEEN 1 AND 15),
  entered_by_index INTEGER REFERENCES players(player_index),
  entered_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_index, round_day, hole_number)
);

-- ── Row Level Security ─────────────────────────────────────────────

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Players: readable by anyone (anon key), no direct writes from client
CREATE POLICY "players_read" ON players FOR SELECT USING (true);

-- Pairings: readable by anyone
CREATE POLICY "pairings_read" ON pairings FOR SELECT USING (true);

-- Scores: readable by anyone (live leaderboard)
CREATE POLICY "scores_read" ON scores FOR SELECT USING (true);

-- Scores: inserts/updates only via service role (API functions)
-- No INSERT/UPDATE policy for anon = only service role can write

-- ── Real-time ─────────────────────────────────────────────────────
-- Enable real-time on scores table in Supabase Dashboard:
-- Database → Replication → Tables → toggle scores ON
