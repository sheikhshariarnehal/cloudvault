import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// POST - Create a share link for a file
export async function POST(request: NextRequest) {
  try {
    // Use service role client to bypass RLS for guest users
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    const { fileId, userId, guestSessionId } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "File ID required" },
        { status: 400 }
      );
    }

    let createdBy: string | undefined;

    // For guest users, create a temporary user record if it doesn't exist
    if (!userId && guestSessionId) {
      const { data: existingGuestUser } = await supabase
        .from("users")
        .select("id")
        .eq("guest_session_id", guestSessionId)
        .single();

      if (!existingGuestUser) {
        // Create a guest user record
        const { data: newGuestUser, error: userError } = await supabase
          .from("users")
          .insert({
            guest_session_id: guestSessionId,
            display_name: "Guest User",
          })
          .select("id")
          .single();

        if (userError) {
          console.error("Failed to create guest user:", userError);
          return NextResponse.json(
            { error: "Failed to create user session" },
            { status: 500 }
          );
        }

        createdBy = newGuestUser.id;
      } else {
        createdBy = existingGuestUser.id;
      }
    } else if (userId) {
      createdBy = userId;
    }

    if (!createdBy) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify the file exists and belongs to the user
    let fileQuery = supabase
      .from("files")
      .select("id")
      .eq("id", fileId);

    if (userId) {
      fileQuery = fileQuery.eq("user_id", userId);
    } else if (guestSessionId) {
      fileQuery = fileQuery.eq("guest_session_id", guestSessionId);
    }

    const { data: file, error: fileError } = await fileQuery.single();

    if (fileError || !file) {
      console.error("File verification error:", fileError);
      return NextResponse.json(
        { error: "File not found or access denied" },
        { status: 404 }
      );
    }

    // Generate a unique token
    const token = randomBytes(16).toString("hex");

    // Check if a share link already exists for this file
    const { data: existingLink } = await supabase
      .from("shared_links")
      .select("*")
      .eq("file_id", fileId)
      .eq("created_by", createdBy)
      .eq("is_active", true)
      .single();

    if (existingLink) {
      // Return the existing link
      return NextResponse.json({ token: existingLink.token });
    }

    // Create a new share link
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("shared_links")
      .insert({
        file_id: fileId,
        created_by: createdBy,
        token,
        is_active: true,
      })
      .select()
      .single();

    if (shareLinkError) {
      console.error("Share link creation error:", shareLinkError);
      return NextResponse.json(
        { error: shareLinkError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ token: shareLink.token });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}
