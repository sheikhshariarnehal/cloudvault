import express from "express";
import os from "os";
import fs from "fs";
import path from "path";
import { sessionManager } from "../session-manager.js";
import { getCacheStats, clearCache } from "./download.js";
import { getLogs } from "../utils/logger.js";

const router = express.Router();

const rootDir = process.cwd();

function resolveStoragePath(envPath: string | undefined, defaultRelative: string) {
  const envCandidate = envPath ? path.resolve(rootDir, envPath) : null;
  const directDefault = path.resolve(rootDir, defaultRelative);
  const serviceDefault = path.resolve(rootDir, "tdlib-service", defaultRelative);

  if (envCandidate && fs.existsSync(envCandidate)) return envCandidate;
  if (fs.existsSync(directDefault)) return directDefault;
  return serviceDefault;
}

const tdlibDataPath = resolveStoragePath(process.env.TDLIB_DATABASE_PATH, "tdlib-data");
const tdlibFilesPath = resolveStoragePath(process.env.TDLIB_FILES_PATH, "tdlib-files");
const appTempPath = path.join(tdlibFilesPath, "temp");
const uploadsPath = path.join(tdlibFilesPath, "uploads");
const uploadsCleanupMinAgeHours = parseInt(process.env.UPLOADS_CLEANUP_MIN_AGE_HOURS || "6", 10);

type DirStats = {
  path: string;
  exists: boolean;
  files: number;
  directories: number;
  bytes: number;
};

function getDirectoryStats(targetPath: string): DirStats {
  const stats: DirStats = {
    path: targetPath,
    exists: fs.existsSync(targetPath),
    files: 0,
    directories: 0,
    bytes: 0
  };

  if (!stats.exists) return stats;

  const walk = (dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        stats.directories += 1;
        walk(fullPath);
      } else if (entry.isFile()) {
        stats.files += 1;
        stats.bytes += fs.statSync(fullPath).size;
      }
    }
  };

  walk(targetPath);
  return stats;
}

function getSafeCleanupCandidates() {
  const candidates: string[] = [];

  if (!fs.existsSync(appTempPath)) {
    return candidates;
  }

  const entries = fs.readdirSync(appTempPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === "cache-index.json" || entry.name.startsWith("botapi_")) {
      candidates.push(path.join(appTempPath, entry.name));
    }
  }

  return candidates;
}

function runSafeLocalCleanup() {
  const candidates = getSafeCleanupCandidates();
  let deletedFiles = 0;
  let deletedBytes = 0;
  const errors: string[] = [];

  for (const filePath of candidates) {
    try {
      const size = fs.statSync(filePath).size;
      fs.unlinkSync(filePath);
      deletedFiles += 1;
      deletedBytes += size;
    } catch (err: any) {
      errors.push(`${filePath}: ${err?.message || "Unknown error"}`);
    }
  }

  return { deletedFiles, deletedBytes, errors };
}

function getStaleUploadCleanupCandidates() {
  const candidates: string[] = [];

  if (!fs.existsSync(uploadsPath)) {
    return candidates;
  }

  const minAgeMs = Math.max(1, uploadsCleanupMinAgeHours) * 60 * 60 * 1000;
  const now = Date.now();

  const walk = (dirPath: string) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const st = fs.statSync(fullPath);
          const ageMs = now - st.mtimeMs;
          if (ageMs >= minAgeMs) {
            candidates.push(fullPath);
          }
        } catch {
          // Ignore files that cannot be stat-ed at this time.
        }
      }
    }
  };

  walk(uploadsPath);
  return candidates;
}

function runStaleUploadsCleanup() {
  const candidates = getStaleUploadCleanupCandidates();
  let deletedFiles = 0;
  let deletedBytes = 0;
  const errors: string[] = [];

  for (const filePath of candidates) {
    try {
      const size = fs.statSync(filePath).size;
      fs.unlinkSync(filePath);
      deletedFiles += 1;
      deletedBytes += size;
    } catch (err: any) {
      errors.push(`${filePath}: ${err?.message || "Unknown error"}`);
    }
  }

  return {
    deletedFiles,
    deletedBytes,
    errors,
    minAgeHours: Math.max(1, uploadsCleanupMinAgeHours)
  };
}

router.get("/storage/stats", (req, res) => {
  const tdlibData = getDirectoryStats(tdlibDataPath);
  const tdlibFiles = getDirectoryStats(tdlibFilesPath);
  const appTemp = getDirectoryStats(appTempPath);
  const uploads = getDirectoryStats(uploadsPath);
  const cleanableFiles = getSafeCleanupCandidates();
  const cleanableUploadFiles = getStaleUploadCleanupCandidates();
  const cleanableBytes = cleanableFiles.reduce((sum, filePath) => {
    try {
      return sum + fs.statSync(filePath).size;
    } catch {
      return sum;
    }
  }, 0);
  const cleanableUploadsBytes = cleanableUploadFiles.reduce((sum, filePath) => {
    try {
      return sum + fs.statSync(filePath).size;
    } catch {
      return sum;
    }
  }, 0);

  res.json({
    timestamp: new Date().toISOString(),
    storage: {
      tdlibData,
      tdlibFiles,
      appTemp,
      uploads,
      cleanable: {
        files: cleanableFiles.length,
        bytes: cleanableBytes,
        rules: ["tdlib-files/temp/cache-index.json", "tdlib-files/temp/botapi_*"]
      },
      uploadsCleanable: {
        files: cleanableUploadFiles.length,
        bytes: cleanableUploadsBytes,
        minAgeHours: Math.max(1, uploadsCleanupMinAgeHours),
        rules: ["tdlib-files/uploads/**/* older than min age"]
      }
    }
  });
});

router.post("/storage/cleanup", (req, res) => {
  console.log("[Admin API] Processing safe local storage cleanup...");
  const result = runSafeLocalCleanup();
  console.log(`[Admin API] Safe local storage cleanup complete: ${result.deletedFiles} files removed`);
  res.json({
    success: result.errors.length === 0,
    result
  });
});

router.post("/storage/uploads/cleanup", (req, res) => {
  console.log("[Admin API] Processing stale uploads cleanup...");
  const result = runStaleUploadsCleanup();
  console.log(`[Admin API] Stale uploads cleanup complete: ${result.deletedFiles} files removed`);
  res.json({
    success: result.errors.length === 0,
    result
  });
});

router.post("/storage/cleanup/all", async (req, res) => {
  console.log("[Admin API] Processing combined cleanup for tdlib-data and tdlib-files...");

  const lruResult = clearCache();
  const safeResult = runSafeLocalCleanup();
  const staleUploadsResult = runStaleUploadsCleanup();
  let optimizeTriggered = false;
  let optimizeError: string | null = null;

  try {
    const client = sessionManager.getBotClient();
    await client.invoke({
      _: "optimizeStorage",
      size: 0,
      ttl: 0,
      count: 0,
      immunity_delay: 0,
      file_types: [],
      chat_ids: [],
      exclude_chat_ids: [],
      return_deleted_file_statistics: false,
      chat_limit: 0
    });
    optimizeTriggered = true;
  } catch (err: any) {
    optimizeError = err?.message || "Unknown optimizeStorage error";
  }

  const tdlibData = getDirectoryStats(tdlibDataPath);
  const tdlibFiles = getDirectoryStats(tdlibFilesPath);
  const appTemp = getDirectoryStats(appTempPath);
  const uploads = getDirectoryStats(uploadsPath);

  res.json({
    success: !optimizeError && safeResult.errors.length === 0,
    result: {
      optimizeTriggered,
      optimizeError,
      lruClearedFiles: lruResult.clearedCount,
      lruClearedBytes: lruResult.clearedBytes,
      safeCleanup: safeResult,
      uploadsCleanup: staleUploadsResult,
      storageAfter: {
        tdlibData,
        tdlibFiles,
        appTemp,
        uploads
      }
    }
  });
});

router.get("/metrics", (req, res) => {
  const stats = sessionManager.getStats();
  
  // OS Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  // Load Average
  const loadAvg = os.loadavg();

  // Cache stats
  const cacheStats = getCacheStats();

  res.json({
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: ((usedMem / totalMem) * 100).toFixed(2)
      },
      cpu: {
        loadAverage: loadAvg
      }
    },
    tdlib: {
      ready: stats.botReady,
      activeSessions: stats.activeSessions,
      maxSessions: stats.maxSessions
    },
    cache: cacheStats
  });
});

router.post("/cache/clear", (req, res) => {
  console.log("[Admin API] Processing cache clear...");
  const result = clearCache();
  console.log(`[Admin API] Cache cleared: ${result.clearedCount} files removed`);
  res.json({ success: true, result });
});

router.post("/tdlib/optimize", async (req, res) => {
  console.log("[Admin API] Processing TDLib storage optimization...");
  try {
    const client = sessionManager.getBotClient();
    await client.invoke({
      _: "optimizeStorage",
      size: 0,
      ttl: 0,
      count: 0,
      immunity_delay: 0,
      file_types: [], // empty = all types
      chat_ids: [],
      exclude_chat_ids: [],
      return_deleted_file_statistics: false,
      chat_limit: 0
    });
    res.json({ success: true, message: "Storage optimization triggered." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/logs", (req, res) => {
  res.json({ logs: getLogs() });
});

export default router;