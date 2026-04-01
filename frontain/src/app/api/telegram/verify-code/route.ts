import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/telegram/verify-code
 * Submit the Telegram auth code entered by the user.
 * Body: { code: string }
 * Returns: { status: "ready" | "password_required" }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code required" }, { status: 400 });
    }

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}/api/telegram/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY,
        },
        body: JSON.stringify({ userId: user.id, code }),
      });
    } catch {
      console.error("[telegram/verify-code] Backend unreachable at", BACKEND_URL);
      return NextResponse.json(
        { error: "Telegram service is unavailable. Please try again later." },
        { status: 503 },
      );
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // If auth is complete, update user's Telegram status in Supabase
    if (data.status === "ready") {
      const { error: saveError } = await supabase
        .from("users")
        .update({
          telegram_connected: true,
          telegram_phone: data.phone ?? null,
          telegram_user_id: data.telegramUserId ?? null,
          telegram_connected_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (saveError) {
        console.error("[telegram/verify-code] Failed to persist Telegram fields:", saveError);
        return NextResponse.json(
          { error: "Telegram verified but profile update failed. Please retry." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[telegram/verify-code] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify code" },
      { status: 500 },
    );
  }
}
