import "server-only";

import { getAdminSupabase } from "@/lib/supabase";

export type OverviewStats = {
  totalUsers: number;
  totalFiles: number;
  totalStorageBytes: number;
  activeLinks: number;
};

export type TrendPoint = {
  date: string;
  total: number;
};

export type RecentUpload = {
  id: string;
  name: string;
  sizeBytes: number;
  userName: string;
  avatarUrl: string | null;
  createdAt: string;
};

export type UserRow = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  isPremium: boolean;
  telegramConnected: boolean;
  createdAt: string;
};

export type FileRow = {
  id: string;
  name: string;
  owner: string;
  sizeBytes: number;
  mimeType: string;
  status: "Active" | "Trashed";
  uploadedAt: string;
};

export type ShareRow = {
  id: string;
  targetName: string;
  targetType: "file" | "folder";
  owner: string;
  downloads: number;
  expiresAt: string | null;
  isActive: boolean;
  isPasswordProtected: boolean;
};

export type StorageCategory = {
  name: string;
  value: number;
};

export type TopUserStorage = {
  name: string;
  usage: number;
};

export type UploadVolumePoint = {
  date: string;
  uploads: number;
  bytes: number;
};

export type FileTypeBreakdownItem = {
  name: string;
  files: number;
  bytes: number;
};

export type TopUploaderItem = {
  name: string;
  uploads: number;
  bytes: number;
};

export type OverviewInsights = {
  newUsers7d: number;
  uploads7d: number;
  activeUploaders30d: number;
  guestUploads30d: number;
  uploads30d: number;
  uploadBytes30d: number;
  avgUploadSizeBytes30d: number;
  uploadVolume30d: UploadVolumePoint[];
  fileTypeBreakdown30d: FileTypeBreakdownItem[];
  topUploaders30d: TopUploaderItem[];
};

export async function getOverviewStats(): Promise<OverviewStats> {
  const adminSupabase = getAdminSupabase();
  const usersCount = await adminSupabase.from("users").select("id", { count: "exact", head: true });
  const filesCount = await adminSupabase
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("is_trashed", false);
  const linksCount = await adminSupabase
    .from("shared_links")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);
  const usersStorage = await adminSupabase.from("users").select("storage_used_bytes");

  const totalStorageBytes = (usersStorage.data ?? []).reduce(
    (sum, row) => sum + Number((row as { storage_used_bytes?: number | null }).storage_used_bytes ?? 0),
    0
  );

  return {
    totalUsers: usersCount.count ?? 0,
    totalFiles: filesCount.count ?? 0,
    activeLinks: linksCount.count ?? 0,
    totalStorageBytes,
  };
}

export async function getGrowthTrend(days = 30): Promise<TrendPoint[]> {
  const adminSupabase = getAdminSupabase();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  const { data } = await adminSupabase
    .from("files")
    .select("created_at")
    .gte("created_at", fromDate.toISOString())
    .eq("is_trashed", false)
    .order("created_at", { ascending: true });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    map.set(d.toISOString().slice(0, 10), 0);
  }

  const trendRows = (data ?? []) as Array<{ created_at: string }>;
  for (const row of trendRows) {
    const day = String(row.created_at).slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
}

export async function getRecentUploads(limit = 10): Promise<RecentUpload[]> {
  const adminSupabase = getAdminSupabase();
  const { data: files } = await adminSupabase
    .from("files")
    .select("id,name,size_bytes,created_at,user_id,guest_session_id")
    .eq("is_trashed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  const fileRows = (files ?? []) as Array<{
    id: string;
    name: string;
    size_bytes: number | null;
    created_at: string;
    user_id: string | null;
    guest_session_id: string | null;
  }>;

  const userIds = Array.from(new Set(fileRows.map((f) => f.user_id).filter(Boolean))) as string[];

  const { data: users } = userIds.length
    ? await adminSupabase.from("users").select("id,email,display_name,avatar_url").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null; avatar_url: string | null }> };

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  return fileRows.map((file) => {
    const owner = file.user_id ? usersById.get(file.user_id) : null;
    const name = owner?.display_name || owner?.email || (file.guest_session_id ? `Guest ${file.guest_session_id.slice(0, 8)}` : "Unknown");

    return {
      id: file.id,
      name: file.name,
      sizeBytes: Number(file.size_bytes ?? 0),
      userName: name,
      avatarUrl: owner?.avatar_url ?? null,
      createdAt: file.created_at,
    };
  });
}

export async function getUsers(limit = 50): Promise<UserRow[]> {
  const adminSupabase = getAdminSupabase();
  const { data } = await adminSupabase
    .from("users")
    .select("id,display_name,email,avatar_url,storage_used_bytes,storage_limit_bytes,is_premium,telegram_connected,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const userRows = (data ?? []) as Array<{
    id: string;
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
    storage_used_bytes: number | null;
    storage_limit_bytes: number | null;
    is_premium: boolean | null;
    telegram_connected: boolean | null;
    created_at: string;
  }>;

  return userRows.map((row) => ({
    id: row.id,
    displayName: row.display_name || row.email || "Unnamed user",
    email: row.email || "-",
    avatarUrl: row.avatar_url,
    storageUsedBytes: Number(row.storage_used_bytes ?? 0),
    storageLimitBytes: Number(row.storage_limit_bytes ?? 0),
    isPremium: Boolean(row.is_premium),
    telegramConnected: Boolean(row.telegram_connected),
    createdAt: row.created_at,
  }));
}

export async function getFiles(limit = 100): Promise<FileRow[]> {
  const adminSupabase = getAdminSupabase();
  const { data: files } = await adminSupabase
    .from("files")
    .select("id,name,size_bytes,mime_type,is_trashed,created_at,user_id,guest_session_id")
    .order("created_at", { ascending: false })
    .limit(limit);

  const fileRows = (files ?? []) as Array<{
    id: string;
    name: string;
    size_bytes: number | null;
    mime_type: string | null;
    is_trashed: boolean | null;
    created_at: string;
    user_id: string | null;
    guest_session_id: string | null;
  }>;

  const userIds = Array.from(new Set(fileRows.map((f) => f.user_id).filter(Boolean))) as string[];
  const { data: users } = userIds.length
    ? await adminSupabase.from("users").select("id,email,display_name").in("id", userIds)
    : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  return fileRows.map((file) => {
    const owner = file.user_id ? usersById.get(file.user_id) : null;
    const ownerLabel = owner?.email || owner?.display_name || (file.guest_session_id ? `Guest ${file.guest_session_id.slice(0, 8)}` : "Unknown");

    return {
      id: file.id,
      name: file.name,
      owner: ownerLabel,
      sizeBytes: Number(file.size_bytes ?? 0),
      mimeType: file.mime_type || "application/octet-stream",
      status: file.is_trashed ? "Trashed" : "Active",
      uploadedAt: file.created_at,
    };
  });
}

export async function getShares(limit = 100): Promise<ShareRow[]> {
  const adminSupabase = getAdminSupabase();
  const { data: shares } = await adminSupabase
    .from("shared_links")
    .select("id,file_id,folder_id,created_by,download_count,max_downloads,expires_at,is_active,is_password_protected")
    .order("created_at", { ascending: false })
    .limit(limit);

  const shareRows = (shares ?? []) as Array<{
    id: string;
    file_id: string | null;
    folder_id: string | null;
    created_by: string;
    download_count: number | null;
    expires_at: string | null;
    is_active: boolean | null;
    is_password_protected: boolean | null;
  }>;

  const creatorIds = Array.from(new Set(shareRows.map((s) => s.created_by).filter(Boolean))) as string[];
  const fileIds = Array.from(new Set(shareRows.map((s) => s.file_id).filter(Boolean))) as string[];
  const folderIds = Array.from(new Set(shareRows.map((s) => s.folder_id).filter(Boolean))) as string[];

  const [users, files, folders] = await Promise.all([
    creatorIds.length
      ? adminSupabase.from("users").select("id,email,display_name").in("id", creatorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; display_name: string | null }> }),
    fileIds.length
      ? adminSupabase.from("files").select("id,name").in("id", fileIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    folderIds.length
      ? adminSupabase.from("folders").select("id,name").in("id", folderIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const usersById = new Map((users.data ?? []).map((u) => [u.id, u]));
  const filesById = new Map((files.data ?? []).map((f) => [f.id, f]));
  const foldersById = new Map((folders.data ?? []).map((f) => [f.id, f]));

  return shareRows.map((share) => {
    const creator = usersById.get(share.created_by);
    const targetType = share.file_id ? "file" : "folder";
    const targetName =
      (share.file_id ? filesById.get(share.file_id)?.name : foldersById.get(share.folder_id || "")?.name) ||
      "Unknown target";

    return {
      id: share.id,
      targetName,
      targetType,
      owner: creator?.email || creator?.display_name || "Unknown",
      downloads: Number(share.download_count ?? 0),
      expiresAt: share.expires_at,
      isActive: Boolean(share.is_active),
      isPasswordProtected: Boolean(share.is_password_protected),
    };
  });
}

export async function getStorageBreakdown(): Promise<StorageCategory[]> {
  const adminSupabase = getAdminSupabase();
  const { data } = await adminSupabase.from("files").select("mime_type,size_bytes").eq("is_trashed", false);

  const categories = {
    Photos: 0,
    Videos: 0,
    Documents: 0,
    Others: 0,
  };

  const rows = (data ?? []) as Array<{ mime_type: string | null; size_bytes: number | null }>;
  for (const row of rows) {
    const mime = row.mime_type || "";
    const size = Number(row.size_bytes ?? 0);

    if (mime.startsWith("image/")) categories.Photos += size;
    else if (mime.startsWith("video/")) categories.Videos += size;
    else if (mime.includes("pdf") || mime.includes("text") || mime.includes("word") || mime.includes("sheet") || mime.includes("presentation")) {
      categories.Documents += size;
    } else {
      categories.Others += size;
    }
  }

  return Object.entries(categories).map(([name, value]) => ({ name, value }));
}

export async function getTopUsersByStorage(limit = 10): Promise<TopUserStorage[]> {
  const adminSupabase = getAdminSupabase();
  const { data } = await adminSupabase
    .from("users")
    .select("display_name,email,storage_used_bytes")
    .order("storage_used_bytes", { ascending: false })
    .limit(limit);

  const topRows = (data ?? []) as Array<{ display_name: string | null; email: string | null; storage_used_bytes: number | null }>;

  return topRows.map((row) => ({
    name: row.display_name || row.email || "Unknown",
    usage: Number(row.storage_used_bytes ?? 0),
  }));
}

export async function getOverviewInsights(days = 30): Promise<OverviewInsights> {
  const adminSupabase = getAdminSupabase();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [filesResult, users7dResult] = await Promise.all([
    adminSupabase
      .from("files")
      .select("created_at,size_bytes,mime_type,user_id,guest_session_id")
      .gte("created_at", fromDate.toISOString())
      .eq("is_trashed", false),
    adminSupabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  const fileRows = (filesResult.data ?? []) as Array<{
    created_at: string;
    size_bytes: number | null;
    mime_type: string | null;
    user_id: string | null;
    guest_session_id: string | null;
  }>;

  const dateMap = new Map<string, UploadVolumePoint>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() + i);
    const isoDay = d.toISOString().slice(0, 10);
    dateMap.set(isoDay, { date: isoDay, uploads: 0, bytes: 0 });
  }

  const typeMap = new Map<string, FileTypeBreakdownItem>();
  const uploaderMap = new Map<string, { userId: string | null; guestSessionId: string | null; uploads: number; bytes: number }>();
  const activeUploaders = new Set<string>();

  let uploads7d = 0;
  let guestUploads30d = 0;
  let uploads30d = 0;
  let uploadBytes30d = 0;

  for (const row of fileRows) {
    const createdAt = new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;

    const isoDay = row.created_at.slice(0, 10);
    const point = dateMap.get(isoDay);
    const size = Number(row.size_bytes ?? 0);

    if (point) {
      point.uploads += 1;
      point.bytes += size;
    }

    uploads30d += 1;
    uploadBytes30d += size;

    if (createdAt >= sevenDaysAgo) {
      uploads7d += 1;
    }

    if (row.guest_session_id) {
      guestUploads30d += 1;
    }

    const uploaderKey = row.user_id ? `user:${row.user_id}` : `guest:${row.guest_session_id || "unknown"}`;
    activeUploaders.add(uploaderKey);

    const currentUploader = uploaderMap.get(uploaderKey);
    if (currentUploader) {
      currentUploader.uploads += 1;
      currentUploader.bytes += size;
    } else {
      uploaderMap.set(uploaderKey, {
        userId: row.user_id,
        guestSessionId: row.guest_session_id,
        uploads: 1,
        bytes: size,
      });
    }

    let typeName = "Others";
    const mime = row.mime_type || "";
    if (mime.startsWith("image/")) typeName = "Images";
    else if (mime.startsWith("video/")) typeName = "Videos";
    else if (mime.includes("pdf") || mime.startsWith("text/") || mime.includes("word") || mime.includes("sheet") || mime.includes("presentation")) {
      typeName = "Documents";
    } else if (!mime) {
      typeName = "Unknown";
    }

    const currentType = typeMap.get(typeName);
    if (currentType) {
      currentType.files += 1;
      currentType.bytes += size;
    } else {
      typeMap.set(typeName, {
        name: typeName,
        files: 1,
        bytes: size,
      });
    }
  }

  const uploaderUserIds = Array.from(
    new Set(
      Array.from(uploaderMap.values())
        .map((item) => item.userId)
        .filter(Boolean)
    )
  ) as string[];

  const usersById = new Map<string, { display_name: string | null; email: string | null }>();
  if (uploaderUserIds.length) {
    const { data: users } = await adminSupabase
      .from("users")
      .select("id,display_name,email")
      .in("id", uploaderUserIds);

    for (const user of (users ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>) {
      usersById.set(user.id, { display_name: user.display_name, email: user.email });
    }
  }

  const topUploaders30d = Array.from(uploaderMap.values())
    .map((item) => {
      const user = item.userId ? usersById.get(item.userId) : null;
      const name = user?.display_name || user?.email || (item.guestSessionId ? `Guest ${item.guestSessionId.slice(0, 8)}` : "Unknown");

      return {
        name,
        uploads: item.uploads,
        bytes: item.bytes,
      };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 8);

  const fileTypeBreakdown30d = Array.from(typeMap.values()).sort((a, b) => b.bytes - a.bytes);
  const uploadVolume30d = Array.from(dateMap.values());

  return {
    newUsers7d: users7dResult.count ?? 0,
    uploads7d,
    activeUploaders30d: activeUploaders.size,
    guestUploads30d,
    uploads30d,
    uploadBytes30d,
    avgUploadSizeBytes30d: uploads30d > 0 ? Math.round(uploadBytes30d / uploads30d) : 0,
    uploadVolume30d,
    fileTypeBreakdown30d,
    topUploaders30d,
  };
}

export async function getStorageGrowthTrend(days = 30): Promise<{ date: string; totalBytes: number }[]> {
  const adminSupabase = getAdminSupabase();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  const { data } = await adminSupabase
    .from("files")
    .select("created_at, size_bytes")
    .gte("created_at", fromDate.toISOString())
    .eq("is_trashed", false)
    .order("created_at", { ascending: true });

  const rows = (data || []) as Array<{ created_at: string; size_bytes: number }>;

  const trendMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    trendMap[dateStr] = 0;
  }

  for (const row of rows) {
    const dStr = row.created_at.split("T")[0];
    if (trendMap[dStr] !== undefined) {
      trendMap[dStr] += Number(row.size_bytes || 0);
    }
  }

  return Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalBytes]) => ({ date, totalBytes }));
}

export async function getFilesStatusBreakdown(): Promise<{ status: string; totalBytes: number; count: number }[]> {
  const adminSupabase = getAdminSupabase();
  const { data } = await adminSupabase.from("files").select("is_trashed, size_bytes");

  const rows = (data || []) as Array<{ is_trashed: boolean; size_bytes: number }>;
  let activeBytes = 0, activeCount = 0;
  let trashedBytes = 0, trashedCount = 0;

  for (const row of rows) {
    if (row.is_trashed) {
      trashedBytes += Number(row.size_bytes || 0);
      trashedCount++;
    } else {
      activeBytes += Number(row.size_bytes || 0);
      activeCount++;
    }
  }

  return [
    { status: "Active Files", totalBytes: activeBytes, count: activeCount },
    { status: "Trashed Files", totalBytes: trashedBytes, count: trashedCount }
  ];
}
