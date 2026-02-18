import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/env";
import type { Database } from "../types/database.types";
import type { DbFile, FileInsert } from "../types";

let supabase: SupabaseClient<Database>;

function getClient(): SupabaseClient<Database> {
  if (!supabase) {
    supabase = createClient<Database>(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

/**
 * Insert a file record into the `files` table.
 */
export async function insertFileRecord(record: FileInsert): Promise<DbFile> {
  const { data, error } = await getClient()
    .from("files")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw Object.assign(new Error(`Supabase insert failed: ${error.message}`), {
      statusCode: 500,
    });
  }

  return data;
}

/**
 * Increment a user's storage usage via the `increment_storage` RPC.
 */
export async function incrementStorage(
  userId: string,
  bytes: number
): Promise<void> {
  const { error } = await getClient().rpc("increment_storage", {
    user_id_param: userId,
    bytes_param: bytes,
  });

  if (error) {
    console.error("[Supabase] increment_storage failed:", error.message);
    // Non-fatal — file was already saved, just log the error
  }
}
