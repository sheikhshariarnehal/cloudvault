import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/telegram/status
 * Check the current user's Telegram connection status.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check DB first — fast path
    const { data: profile } = await supabase
      .from("users")
      .select("telegram_connected, telegram_phone, telegram_user_id")
      .eq("id", user.id)
      .single();

    if (profile?.telegram_connected) {
      return NextResponse.json({
        connected: true,
        phone: profile.telegram_phone,
        telegramUserId: profile.telegram_user_id,
      });
    }

    // Also check active session on backend (in case DB is stale)
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/telegram/status/${encodeURIComponent(user.id)}`,
        { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(5000) },
      );

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Backend unreachable — fall through to DB-only result
      console.warn("[telegram/status] Backend unreachable, using DB-only status");
    }

    return NextResponse.json({ connected: false });
  } catch (error) {
    console.error("[telegram/status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 },
    );
  }
}
