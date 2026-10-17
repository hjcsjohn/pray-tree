import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// This dedicated Prayer Tree site must always authenticate against its own
// Supabase project. The URL is a public project endpoint, not a secret.
// Pinning it here avoids an old NEXT_PUBLIC_SUPABASE_URL getting baked into
// a cached browser bundle during deployments.
const url = "https://ovpupevdhtjbtsiynmku.supabase.co";
// Dedicated environment variable to avoid collisions with old Vercel/Supabase integrations.
const key = process.env.NEXT_PUBLIC_PRAYER_TREE_KEY;

// One browser client for the entire application. Multiple clients can race
// to consume an email-link callback or overwrite the stored auth session.
let browserClient: SupabaseClient | null = null;

export function supabaseReady() {
  return Boolean(url && key && url.startsWith("https://"));
}

export function supabaseBrowser() {
  if (!url || !key) throw new Error("Supabase 환경변수를 먼저 설정해 주세요.");
  if (!browserClient) {
    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        storageKey: "prayer-tree-auth",
      },
    });
  }
  return browserClient;
}
