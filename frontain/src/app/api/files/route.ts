import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List files for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const userId = searchParams.get("user_id");
    const guestSessionId = searchParams.get("guest_session_id");
    const folderId = searchParams.get("folder_id");
    const starred = searchParams.get("starred");
    const trashed = searchParams.get("trashed");

    let query = supabase.from("files").select("*");

    if (userId) query = query.eq("user_id", userId);
    else if (guestSessionId)
      query = query.eq("guest_session_id", guestSessionId);
    else
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    if (folderId) query = query.eq("folder_id", folderId);
    if (starred === "true") query = query.eq("is_starred", true);
    if (trashed === "true") query = query.eq("is_trashed", true);
    else query = query.eq("is_trashed", false);

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// PATCH - Update file (rename, star, trash, move)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "File ID required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("files")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ file: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}

// POST - Copy file
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    if (body.action === "copy") {
      const { data: original, error: fetchError } = await supabase
        .from("files")
        .select("*")
        .eq("id", body.fileId)
        .single();

      if (fetchError || !original) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }

      const { id, created_at, updated_at, ...copyData } = original;
      copyData.name = `Copy of ${copyData.name}`;

      const { data, error } = await supabase
        .from("files")
        .insert(copyData)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ file: data }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
