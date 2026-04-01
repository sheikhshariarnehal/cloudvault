import "server-only";

import { createClient } from "@supabase/supabase-js";

let cachedClient: ReturnType<typeof createClient> | null = null;

export class MissingAdminSupabaseEnvError extends Error {
  constructor() {
    super("Missing Supabase environment variables for admin dashboard.");
    this.name = "MissingAdminSupabaseEnvError";
  }
}

export function isMissingAdminSupabaseEnvError(error: unknown): error is MissingAdminSupabaseEnvError {
  return error instanceof MissingAdminSupabaseEnvError;
}

export function getAdminSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new MissingAdminSupabaseEnvError();
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
