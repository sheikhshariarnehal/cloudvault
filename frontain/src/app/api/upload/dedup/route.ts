import { NextRequest, NextResponse } from "next/server";
import { createClient as createRLSClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Service-role Supabase client — bypasses RLS so we can query
 * file hashes across ALL users for global content dedup.
 */
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * POST /api/upload/dedup
 * Check if a file with the same name OR same content hash already exists.
 *
 * - Name dedup: scoped to same user + folder (prevents exact duplicates).
 * - Hash dedup: **global across all users** — if ANY user has already
 *   uploaded the same content, we re-use the Telegram file (instant upload).
 *
 * Precedence: name match > hash match.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileHash, userId, guestSessionId, folderId } = body;

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }
    if (!userId && !guestSessionId) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const supabase = await createRLSClient();

    // ── 1. Name-based dedup (same name in same folder for same user) ─

    let nameQuery = supabase
      .from("files")
      .select()
      .eq("name", fileName)
      .eq("is_trashed", false);

    if (userId) {
      nameQuery = nameQuery.eq("user_id", userId);
    } else {
      nameQuery = nameQuery.eq("guest_session_id", guestSessionId);
    }

    if (folderId) {
      nameQuery = nameQuery.eq("folder_id", folderId);
    } else {
      nameQuery = nameQuery.is("folder_id", null);
    }

    const { data: nameMatch, error: nameLookupError } = await nameQuery.limit(1).maybeSingle();

    if (nameLookupError) {
      console.error("[dedup] Name lookup error:", nameLookupError);
      return NextResponse.json({ duplicate: false });
    }

    if (nameMatch) {
      return NextResponse.json({
        duplicate: true,
        reason: "name",
        file: nameMatch,
        existingName: nameMatch.name,
        crossUser: false,
      });
    }

    // ── 2. Hash-based dedup (GLOBAL — same content by ANY user) ──────
    // Uses service-role client to bypass RLS and search all files.

    if (fileHash) {
      const serviceClient = getServiceClient();

      const { data: hashMatch, error: hashLookupError } = await serviceClient
        .from("files")
        .select("id, name, mime_type, size_bytes, telegram_file_id, telegram_message_id, tdlib_file_id, thumbnail_url, file_hash, user_id, guest_session_id")
        .eq("file_hash", fileHash)
        .eq("is_trashed", false)
        .limit(1)
        .maybeSingle();

      if (hashLookupError) {
        console.error("[dedup] Hash lookup error:", hashLookupError);
        return NextResponse.json({ duplicate: false });
      }

      if (hashMatch) {
        // Determine if this is a cross-user match
        const isCrossUser = userId
          ? hashMatch.user_id !== userId
          : hashMatch.guest_session_id !== guestSessionId;

        console.log(
          `[dedup] Hash match found: file "${hashMatch.name}" (${hashMatch.id})`,
          isCrossUser ? "(cross-user — instant upload!)" : "(same user)"
        );

        // Same content exists — re-use its Telegram file_id by creating a
        // new DB record pointing to the same Telegram message. This avoids
        // re-uploading the same bytes to Telegram.
        return NextResponse.json({
          duplicate: true,
          reason: "hash",
          file: hashMatch,
          existingName: hashMatch.name,
          crossUser: isCrossUser,
        });
      }
    }

    // No collision — proceed with normal upload
    return NextResponse.json({ duplicate: false });
  } catch (error) {
    console.error("[dedup] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dedup check failed" },
      { status: 500 }
    );
  }
}
