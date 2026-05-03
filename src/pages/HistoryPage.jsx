import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

/** Phase 2 will flesh this out (event cards with status badges + team colors).
 *  Phase 1 shell: minimal list of events sorted by start_date desc. */
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

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.goldBar} />
        <div style={S.header}>
          <div style={S.eyebrow}>History · Past & Active Events</div>
          <div style={S.title}>🗓 Events</div>
        </div>
        <div style={{ padding: '12px 16px 18px' }}>
          {loading && <div style={S.empty}>Loading…</div>}
          {!loading && events.length === 0 && (
            <div style={S.empty}>No events yet. Run the multi-event migration to seed Stellenbosch 2026.</div>
          )}
          {events.map(ev => (
            <Link key={ev.id} to={`/events/${ev.slug}/leaderboard`} style={S.eventLink}>
              <div style={S.evCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={S.evName}>{ev.name}</div>
                  <div style={statusBadge(ev)}>{statusLabel(ev)}</div>
                </div>
                <div style={S.evMeta}>{ev.course_name} · {fmtRange(ev.start_date, ev.end_date)}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, fontFamily: 'Helvetica Neue,Arial,sans-serif' }}>
                  <span style={{ color: ev.team_a_color }}>● {ev.team_a_name}</span>
                  <span style={{ color: 'rgba(245,240,232,0.3)' }}>vs</span>
                  <span style={{ color: ev.team_b_color }}>● {ev.team_b_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div style={S.goldBar} />
      </div>
    </div>
  );
}

function statusLabel(ev) {
  if (ev.is_archived) return 'Archived';
  if (ev.is_active) return 'Active';
  return 'Draft';
}
function statusBadge(ev) {
  const base = { fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 2, fontFamily: 'Helvetica Neue,Arial,sans-serif' };
  if (ev.is_active) return { ...base, background: 'rgba(106,211,93,0.18)', color: '#6ad35d', border: '1px solid rgba(106,211,93,0.4)' };
  if (ev.is_archived) return { ...base, background: 'rgba(245,240,232,0.05)', color: 'rgba(245,240,232,0.4)', border: '1px solid rgba(245,240,232,0.15)' };
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
  empty: { textAlign: 'center', color: 'rgba(245,240,232,0.4)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, padding: 24 },
  eventLink: { textDecoration: 'none' },
  evCard: { background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(245,240,232,0.05)', borderRadius: 3, padding: '12px 14px', marginBottom: 8 },
  evName: { fontSize: 15, color: C.text, flex: 1, marginRight: 8 },
  evMeta: { fontSize: 11, color: 'rgba(245,240,232,0.45)', fontFamily: 'Helvetica Neue,Arial,sans-serif' },
};
