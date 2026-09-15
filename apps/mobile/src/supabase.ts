import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { sessionStorage } from './storage.ts';

/**
 * The Supabase client, and the only file that constructs one.
 *
 * Built on first use rather than at import, so a missing `.env` surfaces when
 * someone publishes -- with a message naming what is missing -- instead of
 * crashing the app at launch. Nothing but publishing needs the network.
 *
 * The key here is the PUBLISHABLE one and it ships inside the bundle, where
 * anyone can read it. That is the design, not an oversight: row-level security
 * and the column grants are the boundary, and they are what `scripts/
 * publish-smoke.mjs` actually tests. The secret key belongs nowhere near this
 * repository.
 */

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env and fill them in.',
    );
  }

  client = createClient(url, key, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      // There is no URL for a session to arrive in on a device, and leaving
      // this on makes the client reach for browser globals that do not exist.
      detectSessionInUrl: false,
    },
  });

  return client;
}
