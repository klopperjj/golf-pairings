import { createClient } from '@supabase/supabase-js';

/** Resolve a Supabase client from env vars. */
export function getSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Resolve the active event ID from a request, falling back to the global
 * is_active = TRUE event if none is supplied.
 *
 * Player-authenticated endpoints should prefer the event_id baked into the
 * JWT (set at login) — call resolveEventIdFromJWT(decoded) instead.
 */
export async function resolveActiveEventId(supabase) {
  const { data, error } = await supabase
    .from('events')
    .select('id, is_archived')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (error || !data) return { eventId: null, isArchived: false, error: 'No active event configured' };
  return { eventId: data.id, isArchived: !!data.is_archived, error: null };
}

/** Trust the JWT payload for the event scope. Returns null if absent. */
export function resolveEventIdFromJWT(decoded) {
  return decoded?.event_id || null;
}

/** Find an event by slug. Useful for endpoints that accept an explicit slug. */
export async function findEventBySlug(supabase, slug) {
  if (!slug) return null;
  const { data } = await supabase
    .from('events')
    .select('id, slug, is_archived')
    .eq('slug', slug)
    .limit(1)
    .single();
  return data || null;
}
