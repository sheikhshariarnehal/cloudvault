import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";

/**
 * POST /api/telegram/disconnect
 * Disconnect the current user's Telegram account.
 * Logs out TDLib session and clears DB fields.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Tell backend to destroy the TDLib session
    try {
      const response = await fetch(`${BACKEND_URL}/api/telegram/disconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error("[telegram/disconnect] Backend error:", data);
      }
    } catch {
      console.warn("[telegram/disconnect] Backend unreachable, clearing DB only");
    }

    // Clear Telegram fields in Supabase regardless of backend result
    await supabase
      .from("users")
      .update({
        telegram_connected: false,
        telegram_phone: null,
        telegram_user_id: null,
        telegram_connected_at: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[telegram/disconnect] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Disconnect failed" },
      { status: 500 },
    );
  }
}
