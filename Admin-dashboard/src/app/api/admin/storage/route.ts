import { NextResponse } from "next/server";

import { tdlibGet } from "@/lib/admin/tdlib-proxy";

export async function GET() {
  try {
    const result = await tdlibGet("/api/admin/storage/stats");
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load storage stats" },
      { status: 500 }
    );
  }
}
