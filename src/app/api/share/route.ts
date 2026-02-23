import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// POST - Create a share link for a file or folder
// Requires an authenticated user (userId).
export async function POST(request: NextRequest) {
  try {
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
    const { fileId, folderId, userId, regenerate } = await request.json();

    if (!fileId && !folderId) {
      return NextResponse.json(
        { error: "File ID or Folder ID required" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Sign in required to share files and folders" },
        { status: 401 }
      );
    }

    // Ensure authenticated user has a public.users profile
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (!existingUser) {
      const { error: profileError } = await supabase
        .from("users")
        .upsert({ id: userId, display_name: "User" }, { onConflict: "id" });

      if (profileError) {
        console.error("Failed to ensure user profile:", profileError);
        return NextResponse.json(
          { error: "Failed to verify user account" },
          { status: 500 }
        );
      }
    }

    const createdBy = userId;

    // Verify ownership — check user_id on the file/folder
    if (fileId) {
      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("id")
        .eq("id", fileId)
        .eq("user_id", userId)
        .single();

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
        if (!regenerate) {
          return NextResponse.json({ token: existingLink.token });
        }
        // Deactivate old link before creating a new one
        await supabase
          .from("shared_links")
          .update({ is_active: false })
          .eq("id", existingLink.id);
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
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id")
        .eq("id", folderId)
        .eq("user_id", userId)
        .single();

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
        if (!regenerate) {
          return NextResponse.json({ token: existingLink.token });
        }
        // Deactivate old link before creating a new one
        await supabase
          .from("shared_links")
          .update({ is_active: false })
          .eq("id", existingLink.id);
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
