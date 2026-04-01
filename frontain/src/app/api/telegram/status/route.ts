import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.TDLIB_SERVICE_URL || "http://localhost:3001";
const API_KEY = process.env.TDLIB_SERVICE_API_KEY || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS_RETRY_DELAY_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      // DB says connected — verify the backend session is still alive
      try {
        const response = await fetch(
          `${BACKEND_URL}/api/telegram/status/${encodeURIComponent(user.id)}`,
          { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(5000) },
        );

        if (response.ok) {
          const backendData = await response.json();
          // Backend confirms session exists on disk or in memory
          if (backendData.connected) {
            return NextResponse.json({
              connected: true,
              phone: profile.telegram_phone,
              telegramUserId: profile.telegram_user_id,
            });
          }
        }
      } catch {
        // Backend unreachable — trust DB, session will lazy-reconnect when needed
        return NextResponse.json({
          connected: true,
          phone: profile.telegram_phone,
          telegramUserId: profile.telegram_user_id,
        });
      }

      // Backend says session is gone. Retry once to avoid false disconnects
      // caused by brief TDLib reactivation delays.
      await delay(STATUS_RETRY_DELAY_MS);
      try {
        const retryResponse = await fetch(
          `${BACKEND_URL}/api/telegram/status/${encodeURIComponent(user.id)}`,
          { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(5000) },
        );

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          if (retryData.connected) {
            return NextResponse.json({
              connected: true,
              phone: profile.telegram_phone,
              telegramUserId: profile.telegram_user_id,
            });
          }
        }
      } catch {
        // Keep DB state if retry cannot confirm disconnection.
        return NextResponse.json({
          connected: true,
          phone: profile.telegram_phone,
          telegramUserId: profile.telegram_user_id,
        });
      }

      // Confirmed disconnected on retry — now update DB.
      await supabase
        .from("users")
        .update({
          telegram_connected: false,
          telegram_phone: null,
          telegram_user_id: null,
          telegram_connected_at: null,
        })
        .eq("id", user.id);

      return NextResponse.json({ connected: false });
    }

    // DB says not connected — also check backend (in case DB is stale and backend has a session)
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/telegram/status/${encodeURIComponent(user.id)}`,
        { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(5000) },
      );

      if (response.ok) {
        const data = await response.json();
        // Backend has a session the DB doesn't know about — sync DB
        if (data.connected) {
          const { error: syncError } = await supabase
            .from("users")
            .update({
              telegram_connected: true,
              telegram_user_id: data.telegramUserId ?? null,
              telegram_connected_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          if (syncError) {
            console.error("[telegram/status] Failed to sync connected state:", syncError);
          }
        }
        return NextResponse.json(data);
      }
    } catch {
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
