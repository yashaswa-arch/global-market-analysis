import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// V-17 fix: fail fast in production so misconfiguration is immediately visible
if (import.meta.env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Set these environment variables before building for production."
  );
} else if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase env vars missing — auth will not work until configured.");
}

export const supabase = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnonKey ?? "placeholder"
);

export const getAuthRedirectUrl = () => {
  let url = import.meta.env.VITE_PUBLIC_APP_URL ?? window.location.origin;
  url = url.replace(/\/$/, "");
  return `${url}/auth/callback`;
};
