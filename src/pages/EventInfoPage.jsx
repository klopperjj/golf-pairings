import { useEvent } from '../lib/eventContext.jsx';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

/**
 * Renders the event's info / draw page.
 *
 * Strategy:
 *   1. If `event.info_html` is present, render it (admin-controlled HTML — for the
 *      Stellenbosch event this is the whole legacy `public/draw.html`).
 *   2. For the Stellenbosch event specifically, fall back to the existing
 *      static file at `/draw.html` (keeps PWA links / external bookmarks alive
 *      until info_html is populated).
 *   3. Otherwise render structured sections from the event row's markdown
 *      fields. (Phase 4 will swap to react-markdown.)
 */
export default function EventInfoPage() {
  const { event, eventSlug, isArchived } = useEvent();

  // Stellenbosch fallback: serve the legacy static HTML until info_html is set.
  if (event && !event.info_html && eventSlug === 'stellenbosch-2026') {
    if (typeof window !== 'undefined') {
      window.location.replace('/draw.html');
    }
    return null;
  }

  if (event?.info_html) {
    return (
      <div style={S.page}>
        {isArchived && (
          <div style={S.archivedBanner}>
            🗄 Archived event · {event.name}
          </div>
        )}
        <div
          style={S.htmlWrap}
          dangerouslySetInnerHTML={{ __html: event.info_html }}
        />
      </div>
    );
  }

  // Structured info — basic placeholder render (Phase 4 will use react-markdown)
  return (
    <div style={S.page}>
      {isArchived && (
        <div style={S.archivedBanner}>
          🗄 Archived event · {event?.name}
        </div>
      )}
      <div style={S.card}>
        <div style={S.goldBar} />
        <div style={S.header}>
          <div style={S.eyebrow}>{event?.short_name || event?.course_name}</div>
          <div style={S.title}>{event?.name}</div>
          <div style={S.tagline}>{formatRange(event?.start_date, event?.end_date)}</div>
        </div>

        {event?.itinerary_json && Array.isArray(event.itinerary_json) && event.itinerary_json.length > 0 && (
          <Section title="Itinerary">
            {event.itinerary_json.map((it, i) => (
              <div key={i} style={S.itinRow}>
                <span style={S.itinTime}>{it.time}</span>
                <div>
                  <div style={S.itinTitle}>{it.title}</div>
                  {it.subtitle && <div style={S.itinSub}>{it.subtitle}</div>}
                </div>
              </div>
            ))}
          </Section>
        )}

        {event?.rules_md && <Section title="Rules"><Pre text={event.rules_md} /></Section>}
        {event?.fines_md && <Section title="Fines"><Pre text={event.fines_md} /></Section>}
        {event?.transport_md && <Section title="Travel & Stay"><Pre text={event.transport_md} /></Section>}
        {event?.bios_md && <Section title="Players"><Pre text={event.bios_md} /></Section>}

        <div style={S.goldBar} />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionLabel}>{title}</div>
      {children}
    </div>
  );
}

function Pre({ text }) {
  return <pre style={S.pre}>{text}</pre>;
}

function formatRange(start, end) {
  if (!start) return '';
  const s = new Date(start);
  const e = new Date(end || start);
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return start === end ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
}

const S = {
  page: { background: C.darkGreen, minHeight: '100vh', padding: '20px 16px', fontFamily: "Georgia,'Times New Roman',serif" },
  archivedBanner: {
    maxWidth: 480, margin: '0 auto 12px', padding: '10px 16px',
    background: 'rgba(245,240,232,0.06)', border: '1px solid rgba(245,240,232,0.18)',
    borderRadius: 3, color: 'rgba(245,240,232,0.7)', fontSize: 12,
    fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', letterSpacing: 1,
  },
  htmlWrap: { maxWidth: 480, margin: '0 auto', color: C.text },
  card: { background: C.green, maxWidth: 480, margin: '0 auto', borderRadius: 3, color: C.text, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '24px 24px 16px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 8 },
  title: { fontSize: 22 },
  tagline: { fontSize: 11, color: 'rgba(245,240,232,0.4)', fontStyle: 'italic', marginTop: 4 },
  section: { padding: '16px 24px', borderTop: '1px solid rgba(245,240,232,0.06)' },
  sectionLabel: { fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', textAlign: 'center', marginBottom: 12 },
  itinRow: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(245,240,232,0.04)' },
  itinTime: { fontSize: 12, color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', minWidth: 56 },
  itinTitle: { fontSize: 13, color: C.text },
  itinSub: { fontSize: 11, color: 'rgba(245,240,232,0.45)', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginTop: 2 },
  pre: { whiteSpace: 'pre-wrap', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 12, color: 'rgba(245,240,232,0.75)', lineHeight: 1.6, margin: 0 },
};
