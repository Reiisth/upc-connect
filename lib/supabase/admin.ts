import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const localInternalUrl = process.env.NODE_ENV === "development"
    ? process.env.UPC_LOCAL_INTERNAL_SUPABASE_URL
    : undefined;
  if (localInternalUrl) {
    const parsed = new URL(localInternalUrl);
    if (!["http:", "https:"].includes(parsed.protocol) ||
        !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
        parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      throw new Error("Local privileged Supabase URL must use loopback.");
    }
  }
  const supabaseUrl = localInternalUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseSecretKey) {
    throw new Error("Missing SUPABASE_SECRET_KEY");
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
