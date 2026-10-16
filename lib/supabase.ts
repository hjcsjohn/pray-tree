import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseReady() {
  return Boolean(url && key && url.startsWith("https://"));
}

export function supabaseBrowser() {
  if (!url || !key) throw new Error("Supabase 환경변수를 먼저 설정해 주세요.");
  return createClient(url, key);
}
