import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/dedup
 * Check if a file with the same name OR same content hash already exists
 * in the same folder for the same user/session. If it does, skip the upload
 * and return the existing file record so the UI can mark it as a duplicate.
 *
 * Precedence: name match > hash match (both scoped to user + folder).
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

    const supabase = await createClient();

    // ── 1. Name-based dedup (same name in same folder) ───────────────

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
      });
    }

    // ── 2. Hash-based dedup (same content anywhere for this user) ────
    // Only check if the client provided a hash

    if (fileHash) {
      let hashQuery = supabase
        .from("files")
        .select()
        .eq("file_hash", fileHash)
        .eq("is_trashed", false);

      if (userId) {
        hashQuery = hashQuery.eq("user_id", userId);
      } else {
        hashQuery = hashQuery.eq("guest_session_id", guestSessionId);
      }

      const { data: hashMatch, error: hashLookupError } = await hashQuery.limit(1).maybeSingle();

      if (hashLookupError) {
        console.error("[dedup] Hash lookup error:", hashLookupError);
        return NextResponse.json({ duplicate: false });
      }

      if (hashMatch) {
        // Same content exists — re-use its Telegram file_id by creating a
        // new DB record pointing to the same Telegram message. This avoids
        // re-uploading the same bytes to Telegram.
        return NextResponse.json({
          duplicate: true,
          reason: "hash",
          file: hashMatch,
          existingName: hashMatch.name,
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
