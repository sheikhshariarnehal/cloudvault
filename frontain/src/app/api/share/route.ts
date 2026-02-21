import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// POST - Create a share link for a file or folder
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
    const { fileId, folderId, userId, guestSessionId } = await request.json();

    if (!fileId && !folderId) {
      return NextResponse.json(
        { error: "File ID or Folder ID required" },
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

    // Verify ownership based on whether it's a file or folder share
    if (fileId) {
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

      // Check if a share link already exists for this file
      const { data: existingLink } = await supabase
        .from("shared_links")
        .select("*")
        .eq("file_id", fileId)
        .eq("created_by", createdBy)
        .eq("is_active", true)
        .single();

      if (existingLink) {
        return NextResponse.json({ token: existingLink.token });
      }

      // Generate a unique token
      const token = randomBytes(16).toString("hex");

      // Create a new share link for the file
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
    }

    // Folder sharing
    if (folderId) {
      let folderQuery = supabase
        .from("folders")
        .select("id")
        .eq("id", folderId);

      if (userId) {
        folderQuery = folderQuery.eq("user_id", userId);
      } else if (guestSessionId) {
        folderQuery = folderQuery.eq("guest_session_id", guestSessionId);
      }

      const { data: folder, error: folderError } = await folderQuery.single();

      if (folderError || !folder) {
        console.error("Folder verification error:", folderError);
        return NextResponse.json(
          { error: "Folder not found or access denied" },
          { status: 404 }
        );
      }

      // Check if a share link already exists for this folder
      const { data: existingLink } = await supabase
        .from("shared_links")
        .select("*")
        .eq("folder_id", folderId)
        .eq("created_by", createdBy)
        .eq("is_active", true)
        .single();

      if (existingLink) {
        return NextResponse.json({ token: existingLink.token });
      }

      // Generate a unique token
      const token = randomBytes(16).toString("hex");

      // Create a new share link for the folder
      const { data: shareLink, error: shareLinkError } = await supabase
        .from("shared_links")
        .insert({
          folder_id: folderId,
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
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}
