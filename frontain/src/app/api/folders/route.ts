import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Create new folder
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { name, color, parent_id, user_id, guest_session_id } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    if (!user_id && !guest_session_id) {
      return NextResponse.json(
        { error: "User ID or Guest Session ID required" },
        { status: 400 }
      );
    }

    const folderRecord = {
      name: name.trim(),
      color: color || "#EAB308",
      parent_id: parent_id || null,
      user_id: user_id || null,
      guest_session_id: guest_session_id || null,
    };

    const { data, error } = await supabase
      .from("folders")
      .insert(folderRecord)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to create folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ folder: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}

// GET - List folders
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const userId = searchParams.get("user_id");
    const guestSessionId = searchParams.get("guest_session_id");

    let query = supabase
      .from("folders")
      .select("*")
      .eq("is_trashed", false)
      .order("name", { ascending: true });

    if (userId) query = query.eq("user_id", userId);
    else if (guestSessionId)
      query = query.eq("guest_session_id", guestSessionId);
    else
      return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// PATCH - Update folder (rename, move, trash, change color)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Folder ID required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("folders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folder: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete folder
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Folder ID required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("folders")
      .update({
        is_trashed: true,
        trashed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}
