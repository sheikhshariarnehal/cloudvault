import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadFromTelegram, TelegramDownloadError } from "@/lib/telegram/download";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Recursively get all files in a folder and its subfolders
async function getFolderContentsRecursive(
  supabase: ReturnType<typeof getServiceClient>,
  folderId: string
): Promise<{ files: any[]; folders: any[]; totalSize: number }> {
  // Get direct sub-folders
  const { data: subFolders } = await supabase
    .from("folders")
    .select("*")
    .eq("parent_id", folderId)
    .eq("is_trashed", false)
    .order("name");

  // Get direct files
  const { data: files } = await supabase
    .from("files")
    .select("*")
    .eq("folder_id", folderId)
    .eq("is_trashed", false)
    .order("name");

  const allFiles = files || [];
  const allFolders = subFolders || [];
  let totalSize = allFiles.reduce((sum: number, f: any) => sum + (f.size_bytes || 0), 0);

  // Recurse into sub-folders to compute total size
  for (const sf of allFolders) {
    const sub = await getFolderContentsRecursive(supabase, sf.id);
    totalSize += sub.totalSize;
  }

  return { files: allFiles, folders: allFolders, totalSize };
}

// GET - Resolve a share token and return file/folder info or download
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getServiceClient();

    // Look up the share link
    const { data: shareLink, error: linkError } = await supabase
      .from("shared_links")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (linkError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found or expired" },
        { status: 404 }
      );
    }

    // Check if link is expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Share link has expired" },
        { status: 410 }
      );
    }

    // Check max downloads
    if (
      shareLink.max_downloads &&
      shareLink.download_count >= shareLink.max_downloads
    ) {
      return NextResponse.json(
        { error: "Download limit reached" },
        { status: 410 }
      );
    }

    // ===== FOLDER SHARE =====
    if (shareLink.folder_id) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("*")
        .eq("id", shareLink.folder_id)
        .single();

      if (folderError || !folder) {
        return NextResponse.json(
          { error: "Shared folder no longer exists" },
          { status: 404 }
        );
      }

      // If browsing into a subfolder, use the subfolderId query param
      const subfolderId = request.nextUrl.searchParams.get("subfolderId");
      const targetFolderId = subfolderId || shareLink.folder_id;

      // If subfolderId is provided, verify it's actually a descendant of the shared folder
      if (subfolderId) {
        const isDescendant = await verifyDescendant(supabase, shareLink.folder_id, subfolderId);
        if (!isDescendant) {
          return NextResponse.json(
            { error: "Folder not found within shared folder" },
            { status: 403 }
          );
        }
      }

      // Check if requesting a file download within the shared folder
      const downloadFileId = request.nextUrl.searchParams.get("downloadFileId");
      const previewFileId = request.nextUrl.searchParams.get("previewFileId");

      if (downloadFileId) {
        // Verify the file belongs to the shared folder tree
        const isInFolder = await verifyFileInFolder(supabase, shareLink.folder_id, downloadFileId);
        if (!isInFolder) {
          return NextResponse.json(
            { error: "File not found in shared folder" },
            { status: 403 }
          );
        }

        const { data: file } = await supabase
          .from("files")
          .select("*")
          .eq("id", downloadFileId)
          .single();

        if (!file) {
          return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Increment download count
        await supabase
          .from("shared_links")
          .update({ download_count: shareLink.download_count + 1 })
          .eq("id", shareLink.id);

        const { stream } = await downloadFromTelegram(
          file.telegram_file_id,
          file.mime_type || "application/octet-stream",
          file.telegram_message_id,
        );

        return new NextResponse(stream, {
          headers: {
            "Content-Type": file.mime_type || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_name)}"`,
            "Cache-Control": "private, max-age=3600",
          },
        });
      }

      if (previewFileId) {
        // Verify the file belongs to the shared folder tree
        const isInFolder = await verifyFileInFolder(supabase, shareLink.folder_id, previewFileId);
        if (!isInFolder) {
          return NextResponse.json(
            { error: "File not found in shared folder" },
            { status: 403 }
          );
        }

        const { data: file } = await supabase
          .from("files")
          .select("*")
          .eq("id", previewFileId)
          .single();

        if (!file) {
          return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        const { stream } = await downloadFromTelegram(
          file.telegram_file_id,
          file.mime_type || "application/octet-stream",
          file.telegram_message_id,
        );

        return new NextResponse(stream, {
          headers: {
            "Content-Type": file.mime_type || "application/octet-stream",
            "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
            "Cache-Control": "no-cache",
          },
        });
      }

      // Get the target folder info (for subfolder navigation)
      let currentFolder = folder;
      if (subfolderId && subfolderId !== shareLink.folder_id) {
        const { data: sf } = await supabase
          .from("folders")
          .select("*")
          .eq("id", subfolderId)
          .single();
        if (sf) currentFolder = sf;
      }

      // Get folder contents
      const contents = await getFolderContentsRecursive(supabase, targetFolderId);

      // Build breadcrumb path from root shared folder to current subfolder
      const breadcrumbs = await buildBreadcrumbs(supabase, shareLink.folder_id, targetFolderId);

      return NextResponse.json({
        type: "folder",
        folder: {
          id: currentFolder.id,
          name: currentFolder.name,
          color: currentFolder.color,
          created_at: currentFolder.created_at,
        },
        rootFolder: {
          id: folder.id,
          name: folder.name,
        },
        files: (contents.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          original_name: f.original_name,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
          created_at: f.created_at,
        })),
        folders: (contents.folders || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          created_at: f.created_at,
        })),
        totalSize: contents.totalSize,
        breadcrumbs,
        shareLink: {
          token: shareLink.token,
          created_at: shareLink.created_at,
        },
      });
    }

    // ===== FILE SHARE (existing logic) =====
    // Get the shared file
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("id", shareLink.file_id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "Shared file no longer exists" },
        { status: 404 }
      );
    }

    // Check if this is a download request
    const isDownload = request.nextUrl.searchParams.get("download") === "true";

    if (isDownload) {
      // Increment download count
      await supabase
        .from("shared_links")
        .update({ download_count: shareLink.download_count + 1 })
        .eq("id", shareLink.id);

      // Download from Telegram via TDLib service using the remote file_id
      const { stream } = await downloadFromTelegram(
        file.telegram_file_id,
        file.mime_type || "application/octet-stream",
        file.telegram_message_id,
      );

      return new NextResponse(stream, {
        headers: {
          "Content-Type": file.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_name)}"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Check if this is a preview/stream request (for images, videos, PDFs)
    const isPreview = request.nextUrl.searchParams.get("preview") === "true";

    if (isPreview) {
      const { stream } = await downloadFromTelegram(
        file.telegram_file_id,
        file.mime_type || "application/octet-stream",
        file.telegram_message_id,
      );

      return new NextResponse(stream, {
        headers: {
          "Content-Type": file.mime_type || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Return file metadata (for the share page to render)
    return NextResponse.json({
      type: "file",
      file: {
        id: file.id,
        name: file.name,
        original_name: file.original_name,
        mime_type: file.mime_type,
        size_bytes: file.size_bytes,
        created_at: file.created_at,
      },
      shareLink: {
        token: shareLink.token,
        created_at: shareLink.created_at,
      },
    });
  } catch (error) {
    if (error instanceof TelegramDownloadError) {
      const status = error.statusCode === 404 || error.statusCode === 410 ? 404 : 502;
      const msg = status === 404 ? "File not found on storage" : "Storage service error";
      return NextResponse.json({ error: msg }, { status });
    }
    console.error("Share link error:", error);
    return NextResponse.json(
      { error: "Failed to process share link" },
      { status: 500 }
    );
  }
}

// Verify that a folder is a descendant of the shared root folder
async function verifyDescendant(
  supabase: ReturnType<typeof getServiceClient>,
  rootFolderId: string,
  targetFolderId: string
): Promise<boolean> {
  if (rootFolderId === targetFolderId) return true;

  let currentId: string | null = targetFolderId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === rootFolderId) return true;
    if (visited.has(currentId)) return false; // circular reference protection
    visited.add(currentId);

    const { data: folder }: { data: { parent_id: string | null } | null } = await supabase
      .from("folders")
      .select("parent_id")
      .eq("id", currentId)
      .single();

    if (!folder) return false;
    currentId = folder.parent_id;
  }

  return false;
}

// Verify that a file belongs to the shared folder tree
async function verifyFileInFolder(
  supabase: ReturnType<typeof getServiceClient>,
  rootFolderId: string,
  fileId: string
): Promise<boolean> {
  const { data: file } = await supabase
    .from("files")
    .select("folder_id")
    .eq("id", fileId)
    .single();

  if (!file || !file.folder_id) return false;

  return verifyDescendant(supabase, rootFolderId, file.folder_id);
}

// Build breadcrumb path from root shared folder to target folder
async function buildBreadcrumbs(
  supabase: ReturnType<typeof getServiceClient>,
  rootFolderId: string,
  targetFolderId: string
): Promise<{ id: string; name: string }[]> {
  if (rootFolderId === targetFolderId) {
    const { data: root } = await supabase
      .from("folders")
      .select("id, name")
      .eq("id", rootFolderId)
      .single();
    return root ? [{ id: root.id, name: root.name }] : [];
  }

  const path: { id: string; name: string }[] = [];
  let currentId: string | null = targetFolderId;

  while (currentId) {
    const { data: folder }: { data: { id: string; name: string; parent_id: string | null } | null } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", currentId)
      .single();

    if (!folder) break;

    path.unshift({ id: folder.id, name: folder.name });

    if (folder.id === rootFolderId) break;
    currentId = folder.parent_id;
  }

  return path;
}
