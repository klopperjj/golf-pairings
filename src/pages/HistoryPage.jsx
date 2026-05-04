import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

/**
 * History portal — lists every event row from the DB with status badges
 * (Active, Archived, Draft). The active event gets hero treatment;
 * archived events are listed below as compact cards.
 */
export default function HistoryPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('events')
      .select('id, slug, name, short_name, start_date, end_date, course_name, is_active, is_archived, team_a_name, team_b_name, team_a_color, team_b_color')
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  }, []);

  const active   = events.find(e => e.is_active);
  const archived = events.filter(e => e.is_archived && !e.is_active);
  const drafts   = events.filter(e => !e.is_active && !e.is_archived);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.goldBar} />
        <div style={S.header}>
          <div style={S.eyebrow}>Tournament History</div>
          <div style={S.title}>🗓 Events</div>
          <div style={S.tagline}>
            {events.length === 0
              ? 'No events yet'
              : `${events.length} event${events.length === 1 ? '' : 's'} on record`}
          </div>
        </div>

        <div style={{ padding: '12px 16px 18px' }}>
          {loading && <div style={S.empty}>Loading…</div>}

          {!loading && events.length === 0 && (
            <div style={S.empty}>
              No events yet. Run the multi-event migration and seed an event via
              <code style={{ color: C.gold, marginLeft: 4 }}>/api/admin/event-seed</code>.
            </div>
          )}

          {/* Active event hero */}
          {active && (
            <>
              <div style={S.sectionLabel}>Live Now</div>
              <Link to="/leaderboard" style={S.eventLink}>
                <div style={S.heroCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={S.heroEyebrow}>{active.short_name || active.course_name}</div>
                      <div style={S.heroName}>{active.name}</div>
                    </div>
                    <div style={badgeStyle('active')}>● Live</div>
                  </div>
                  <div style={S.evMeta}>{active.course_name} · {fmtRange(active.start_date, active.end_date)}</div>
                  <div style={S.versusRow}>
                    <span style={{ color: active.team_a_color }}>{active.team_a_name}</span>
                    <span style={{ color: 'rgba(245,240,232,0.3)' }}>vs</span>
                    <span style={{ color: active.team_b_color }}>{active.team_b_name}</span>
                  </div>
                  <div style={S.heroCta}>View live leaderboard →</div>
                </div>
              </Link>
            </>
          )}

          {/* Archived */}
          {archived.length > 0 && (
            <>
              <div style={S.sectionLabel}>Past Events</div>
              {archived.map(ev => <EventCard key={ev.id} ev={ev} />)}
            </>
          )}

          {/* Drafts (created but not active or archived) */}
          {drafts.length > 0 && (
            <>
              <div style={S.sectionLabel}>Drafts</div>
              {drafts.map(ev => <EventCard key={ev.id} ev={ev} />)}
            </>
          )}
        </div>

        <div style={S.goldBar} />
      </div>
    </div>
  );
}

function EventCard({ ev }) {
  return (
    <Link to={`/events/${ev.slug}/leaderboard`} style={S.eventLink}>
      <div style={S.evCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={S.evName}>{ev.name}</div>
          <div style={badgeStyle(statusFor(ev))}>{statusLabel(ev)}</div>
        </div>
        <div style={S.evMeta}>{ev.course_name} · {fmtRange(ev.start_date, ev.end_date)}</div>
        <div style={S.versusRow}>
          <span style={{ color: ev.team_a_color }}>● {ev.team_a_name}</span>
          <span style={{ color: 'rgba(245,240,232,0.3)' }}>vs</span>
          <span style={{ color: ev.team_b_color }}>● {ev.team_b_name}</span>
        </div>
      </div>
    </Link>
  );
}

function statusFor(ev) {
  if (ev.is_active) return 'active';
  if (ev.is_archived) return 'archived';
  return 'draft';
}
function statusLabel(ev) {
  if (ev.is_archived) return 'Archived';
  if (ev.is_active) return 'Active';
  return 'Draft';
}
function badgeStyle(kind) {
  const base = { fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, fontFamily: 'Helvetica Neue,Arial,sans-serif' };
  if (kind === 'active')   return { ...base, background: 'rgba(106,211,93,0.18)', color: '#6ad35d', border: '1px solid rgba(106,211,93,0.4)' };
  if (kind === 'archived') return { ...base, background: 'rgba(245,240,232,0.05)', color: 'rgba(245,240,232,0.4)', border: '1px solid rgba(245,240,232,0.15)' };
  return { ...base, background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.7)', border: '1px solid rgba(201,168,76,0.25)' };
}
function fmtRange(a, b) {
  if (!a) return '';
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
}

const S = {
  page: { background: C.darkGreen, minHeight: '100vh', padding: '20px 16px', fontFamily: "Georgia,'Times New Roman',serif", display: 'flex', justifyContent: 'center' },
  card: { background: C.green, width: '100%', maxWidth: 480, borderRadius: 3, color: C.text, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '20px 24px 14px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 6 },
  title: { fontSize: 20 },
  tagline: { fontSize: 11, color: 'rgba(245,240,232,0.4)', fontStyle: 'italic', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 6 },
  sectionLabel: { fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(201,168,76,0.55)', fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', marginTop: 14, marginBottom: 8 },
  empty: { textAlign: 'center', color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, padding: 24 },
  eventLink: { textDecoration: 'none' },
  heroCard: { background: 'rgba(106,211,93,0.06)', border: '1px solid rgba(106,211,93,0.3)', borderRadius: 3, padding: '14px 16px', marginBottom: 10 },
  heroEyebrow: { fontSize: 9, color: '#6ad35d', letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 4 },
  heroName: { fontSize: 18, color: C.text, lineHeight: 1.2 },
  heroCta: { marginTop: 10, fontSize: 11, color: '#6ad35d', fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5, textAlign: 'right' },
  evCard: { background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(245,240,232,0.05)', borderRadius: 3, padding: '12px 14px', marginBottom: 8 },
  evName: { fontSize: 15, color: C.text, flex: 1, marginRight: 8 },
  evMeta: { fontSize: 11, color: 'rgba(245,240,232,0.45)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  versusRow: { display: 'flex', gap: 10, marginTop: 8, fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
};
