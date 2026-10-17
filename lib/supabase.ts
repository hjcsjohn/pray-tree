import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
