# Phase 1 Deployment Runbook — Multi-Event Refactor

This deploy converts the app from a single-tournament install (Stellenbosch
2026) into a multi-event platform. The Stellenbosch data is preserved as the
first archived event.

> **Read the whole document before starting.** Steps 1–3 must run in order
> and the gap between them should be short (~2 minutes) to minimise the
> window where the live app is in an inconsistent state.

---

## Prerequisites

- Admin access to https://supabase.com/dashboard for the `golf-pairings` project
- Push access to the GitHub repo
- Vercel auto-deploy is connected (already configured)

## Step 0 — Take a backup snapshot (mandatory)

1. Open Supabase Dashboard → your project → **Database** → **Backups**
2. Click **Create new backup** (or rely on the most recent automatic one if it
   was within the last few hours)
3. Note the backup timestamp — you can restore here if anything goes wrong

## Step 1 — Run the schema migration

1. Open Supabase Dashboard → **SQL Editor** → **New Query**
2. Copy and paste the entire contents of `supabase-migration-events.sql` (in
   the repo root)
3. Click **Run**

The migration runs as a single transaction. Expected output: success and a
small affected-rows count (12 players, 12 pairings, ~18×4×2 scores).

**Verify (run separately in SQL Editor):**

```sql
SELECT slug, name, is_active FROM events;
-- Expect: stellenbosch-2026, Stellenbosch Invitational 2026, true

SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphan_players FROM players;
SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphan_pairings FROM pairings;
SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphan_scores FROM scores;
SELECT count(*) FILTER (WHERE event_id IS NULL) AS orphan_approvals FROM approvals;
-- All should return 0

SELECT player_index, name, is_admin FROM players ORDER BY player_index;
-- Juan (idx 0) should have is_admin = true; everyone else false
```

⚠️ **At this point the LIVE app is broken** — the deployed Vercel build doesn't
know about `event_id` columns yet, so any score-write attempt will fail with
"column event_id violates NOT NULL". Move quickly to Step 2. Reads still work.

## Step 2 — Push the code & let Vercel deploy

```bash
cd "G:/My Drive/Personal/Claude_Personal/golf-pairings"
git add -A
git commit -m "Phase 1: multi-event refactor (events table, EventProvider, scoped APIs)"
git push
```

Vercel auto-deploys in ~30–60 seconds. Watch the Deployments tab. If the build
goes red, screenshot the error; the most likely culprit is a JSX/import typo
in one of the rewired pages.

## Step 3 — Force re-login (clears stale JWTs)

Pre-migration JWTs lack the `event_id` and `is_admin` payload fields. Any
score-write will fail with "Token missing event scope".

Easiest fix: rotate `JWT_SECRET` in Vercel.

1. Vercel Dashboard → `golf-pairings` → **Settings** → **Environment
   Variables**
2. Find `JWT_SECRET`, click ⋯ → Edit → change the value (e.g. append `-v2`)
3. **Save and redeploy** (Settings → Deployments → ⋯ → Redeploy)

All players will be logged out automatically. They sign in again with the same
mobile + PIN; the new JWT carries the correct payload.

> Alternative: have everyone manually clear `localStorage` (Settings → Site
> Settings → Clear data) and sign in again. Rotating the secret is faster.

## Step 4 — Smoke test

1. Open https://golf-pairings.vercel.app — should redirect to `/draw`
2. `/draw` — should show the legacy Stellenbosch info page (auto-redirects
   to `/draw.html`)
3. `/leaderboard` — should show the same data as before, all 5 tabs working
4. `/score` — sign in with your mobile + PIN. Confirm headers say "Stellenbosch
   Invitational 2026" and players are loaded
5. `/admin` — confirm Juan can access (is_admin gate works); other admins not
   yet promoted
6. `/events` — should list one event (Stellenbosch, **Active** badge)
7. `/events/stellenbosch-2026/leaderboard` — same data, slug-routed

## Step 5 — Tag the deploy

```bash
git tag phase-1-multi-event
git push origin phase-1-multi-event
```

So if anything goes sideways later, this is the rollback point.

---

## Rolling back

If anything is wrong after Step 1 and you want to revert:

1. **DB**: Restore the snapshot from Step 0 (Supabase Dashboard → Backups →
   restore). This drops `events` table and removes all `event_id` columns.
2. **Code**: `git revert HEAD` and push.
3. **JWT**: Re-rotate `JWT_SECRET` once more.

---

## Creating a new event (for the next tournament)

Once Phase 1 is deployed and stable:

```bash
curl -X POST https://golf-pairings.vercel.app/api/admin/event-seed \
  -H "Content-Type: application/json" \
  -d '{
    "adminSecret": "<value of ADMIN_SECRET env var>",
    "slug": "spier-2027",
    "name": "Spier Invitational 2027",
    "short_name": "Spier 2027",
    "start_date": "2027-04-29",
    "end_date": "2027-04-30",
    "course_name": "Spier Golf Estate",
    "par_json": { "1":4, "2":4, ... },
    "stroke_index_json": { "1":3, ... },
    "team_a_name": "Team Eagles",
    "team_b_name": "Team Birdies",
    "day_format_json": { "1": "Scramble", "2": "Stableford" },
    "hcp_allowance": 85,
    "set_active": true,
    "players": [ { "player_index": 0, "name": "Juan Klopper", ... }, ... ],
    "pairings": [ { "round_day": 1, "tee_time": "09:00", "team": "A", ... }, ... ]
  }'
```

`set_active: true` archives the previous active event (Stellenbosch) and
makes the new one live. Phase 3 adds an admin UI for this.
