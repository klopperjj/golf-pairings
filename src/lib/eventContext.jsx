import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from './supabase.js';
import { setCourseConfig } from './gameData.js';

const EventContext = createContext(null);

/** Convert JSONB object with string keys to one with numeric keys.
 *  par_json comes back as { "1": 4, "2": 4, ... } from Supabase. */
function numericKeys(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const k of Object.keys(obj)) out[Number(k)] = obj[k];
  return out;
}

/** Convert DB pairings rows (one per team per fourball) into the front-end
 *  shape: { day, teeTime, teamA: [idx, idx], teamB: [idx, idx] } */
function reshapePairings(rows) {
  const byKey = {};
  for (const r of rows) {
    const key = `${r.round_day}-${r.tee_time}`;
    if (!byKey[key]) byKey[key] = { day: r.round_day, teeTime: r.tee_time, teamA: null, teamB: null };
    const indices = [r.player1_index, r.player2_index];
    if (r.team === 'A') byKey[key].teamA = indices;
    else if (r.team === 'B') byKey[key].teamB = indices;
  }
  return Object.values(byKey)
    .filter(g => g.teamA && g.teamB)
    .sort((a, b) => a.day - b.day || a.teeTime.localeCompare(b.teeTime));
}

/** Resolve event slug from URL. /events/:slug/* → slug; otherwise null (use active). */
function slugFromPath(pathname) {
  const m = pathname.match(/^\/events\/([^/]+)/);
  return m ? m[1] : null;
}

export function EventProvider({ children }) {
  const location = useLocation();
  const slug = slugFromPath(location.pathname);

  const [event, setEvent] = useState(null);
  const [players, setPlayers] = useState([]);
  const [pairings, setPairings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // 1. Resolve event by slug or active flag
        let q = supabase.from('events').select('*');
        q = slug ? q.eq('slug', slug) : q.eq('is_active', true);
        const { data: events, error: evErr } = await q.limit(1);
        if (evErr) throw evErr;
        if (!events || !events.length) {
          if (!cancelled) {
            setError(slug
              ? `Event '${slug}' not found.`
              : 'No active event configured. Run the multi-event migration and seed an event.');
            setLoading(false);
          }
          return;
        }
        const ev = events[0];

        // 2. Players for this event
        const { data: pls, error: plErr } = await supabase
          .from('players')
          .select('player_index, name, team, course_hcp, playing_hcp, mobile, is_admin')
          .eq('event_id', ev.id)
          .order('player_index');
        if (plErr) throw plErr;

        // 3. Pairings for this event
        const { data: prs, error: prErr } = await supabase
          .from('pairings')
          .select('round_day, tee_time, team, player1_index, player2_index')
          .eq('event_id', ev.id);
        if (prErr) throw prErr;

        if (cancelled) return;

        setEvent(ev);
        setPlayers((pls || []).map(p => ({
          index: p.player_index,
          name: p.name,
          team: p.team,
          courseHcp: p.course_hcp,
          playingHcp: p.playing_hcp,
          mobile: p.mobile,
          isAdmin: !!p.is_admin,
        })));
        setPairings(reshapePairings(prs || []));
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Update <title> when event loads
  useEffect(() => {
    if (event?.name) document.title = event.name;
  }, [event?.name]);

  // Push the active event's PAR / STROKE_INDEX into gameData.js so that
  // scoring.js (which imports them by reference) operates on this event.
  useEffect(() => {
    if (event) {
      setCourseConfig({
        par: numericKeys(event.par_json),
        strokeIndex: numericKeys(event.stroke_index_json),
      });
    } else {
      setCourseConfig({ par: {}, strokeIndex: {} });
    }
  }, [event?.id]);

  const value = {
    event,                           // raw DB row, or null
    eventId: event?.id ?? null,
    eventSlug: event?.slug ?? null,
    loading,
    error,
    isArchived: !!event?.is_archived,
    isReadOnly: !!event?.is_archived,

    // Course config (numeric-keyed for direct PAR[hole] lookups)
    par: numericKeys(event?.par_json),
    strokeIndex: numericKeys(event?.stroke_index_json),
    dayFormat: numericKeys(event?.day_format_json),

    teamNames: {
      A: event?.team_a_name ?? 'Team A',
      B: event?.team_b_name ?? 'Team B',
    },
    teamColors: {
      A: event?.team_a_color ?? '#c9a84c',
      B: event?.team_b_color ?? '#4ecfb0',
    },
    hcpAllowance: event?.hcp_allowance ?? 85,

    players,                         // [{ index, name, team, courseHcp, playingHcp, mobile, isAdmin }]
    pairings,                        // [{ day, teeTime, teamA: [idx,idx], teamB: [idx,idx] }]

    // Convenience helpers
    playerByIdx: (idx) => players.find(p => p.index === idx) || null,
    dayCount: Object.keys(numericKeys(event?.day_format_json) || {}).length || 2,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used within <EventProvider>');
  return ctx;
}

/** Loading/error fallback component to render at the top of pages while event resolves. */
export function EventLoadingGate({ children }) {
  const { loading, error, event } = useEvent();
  if (loading) {
    return (
      <div style={gateStyles.page}>
        <div style={gateStyles.card}>Loading event…</div>
      </div>
    );
  }
  if (error || !event) {
    return (
      <div style={gateStyles.page}>
        <div style={{ ...gateStyles.card, color: 'rgba(220,100,100,0.9)' }}>
          {error || 'Event not found.'}
        </div>
      </div>
    );
  }
  return children;
}

const gateStyles = {
  page: {
    background: '#0e2d1c', minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, fontFamily: "Georgia, 'Times New Roman', serif",
  },
  card: {
    background: '#1c4832', borderRadius: 3, padding: '24px 28px',
    color: '#f5f0e8', fontSize: 13, textAlign: 'center', maxWidth: 360,
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
};
