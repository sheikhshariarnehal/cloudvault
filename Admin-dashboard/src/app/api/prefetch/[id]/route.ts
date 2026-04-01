import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * POST /api/prefetch/:id
 * Pre-warm a file in TDLib cache with low priority.
 * Fire-and-forget from the client.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: file, error } = await supabase
      .from("files")
      .select("telegram_file_id, size_bytes, storage_type, user_id")
      .eq("id", id)
      .single();

    if (error || !file?.telegram_file_id) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Skip prefetch for user-stored files when the user ID is unavailable
    // (the bot TDLib client cannot access files from a user's personal session)
    const storageType: string = (file as Record<string, unknown>).storage_type as string ?? "bot";
    const userId: string | undefined = (file as Record<string, unknown>).user_id as string | undefined;

    // Fire to backend — don't await the full download, just initiate
    const res = await fetch(`${BACKEND_URL}/api/download/prefetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
      },
      body: JSON.stringify({
        remoteFileId: file.telegram_file_id,
        sizeHint: file.size_bytes,
        storageType,
        userId,
      }),
    });

    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    console.error("[Prefetch API] Error:", err);
    return NextResponse.json(
      { error: "Prefetch failed" },
      { status: 500 },
    );
  }
}
