// ── Course Config ─────────────────────────────────────────────────────────────
//
// PAR and STROKE_INDEX are populated dynamically by <EventProvider> when the
// active event loads. They are exported as mutable objects so that
// `src/lib/scoring.js` can keep importing them directly — every scoring call
// then operates on the active event's hole config without parameter threading.
//
// Player/pairing/day-format data has been moved to per-event tables in
// Supabase. Pages should read those via `useEvent()` from `eventContext.jsx`.

export const PAR = {};
export const STROKE_INDEX = {};

/**
 * Called by EventProvider after fetching an event row. Replaces the contents of
 * PAR and STROKE_INDEX in place (preserves the imported references in
 * scoring.js).
 */
export function setCourseConfig({ par = {}, strokeIndex = {} } = {}) {
  for (const k of Object.keys(PAR)) delete PAR[k];
  Object.assign(PAR, par);
  for (const k of Object.keys(STROKE_INDEX)) delete STROKE_INDEX[k];
  Object.assign(STROKE_INDEX, strokeIndex);
}
