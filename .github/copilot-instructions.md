# CloudVault — Copilot Persistent Context

This file is automatically read by GitHub Copilot in every conversation.
Always apply these rules and constraints without being asked.

---

## Project Identity

- **App name:** CloudVault
- **Purpose:** Google Drive-style cloud storage that uses **Telegram MTProto (TDLib)** as the actual file storage backend
- **Monorepo layout:**
  ```
  /
  ├── frontain/        ← Next.js 16 frontend (deployed on Vercel free plan)
  ├── tdlib-service/   ← Express + TDLib backend (deployed on DigitalOcean $12/mo plan)
  └── .github/         ← This file
  ```

---

## Production Server Constraints — READ BEFORE EVERY SUGGESTION

### Backend — DigitalOcean App Platform ($12/mo)
| Resource | Limit | Impact on suggestions |
|----------|-------|----------------------|
| RAM | **1 GB** | No in-memory caching of large files. No ffmpeg transcoding. No Redis. Max 3 concurrent TDLib uploads. |
| CPU | **1 Shared vCPU** | No CPU-heavy operations (video transcoding, image resizing at scale). |
| Disk | **~25 GB** (ephemeral + persistent mount) | Cache cap hardcoded at 512 MB app-managed + 8 GB TDLib files. Never raise defaults above these. |
| Bandwidth | **150 GB/mo** | Every download proxied through this server counts. Avoid unnecessary re-downloads. |
| Node.js | ESM (`"type": "module"`) | Always use `.js` extensions in imports, never `.ts`. |

### Frontend — Vercel Free Plan
| Resource | Limit | Impact on suggestions |
|----------|-------|----------------------|
| Serverless functions | **10s default, 300s max** (set per-route) | Long-running routes MUST have `export const maxDuration = 300` |
| No persistent storage | Stateless | Never store files, caches, or sessions in Vercel functions |
| No Redis / no shared memory | Stateless | All caching must be on the DO backend or in Supabase |

### What is NOT available on this stack
- ❌ Redis
- ❌ ffmpeg / video transcoding
- ❌ Image resizing / thumbnail generation beyond TDLib built-ins
- ❌ CDN (Cloudflare not configured)
- ❌ WebSockets from Vercel (use Supabase Realtime instead)
- ❌ Background jobs / cron on Vercel

---

## Tech Stack

### Frontend (`frontain/`)
- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS v4
- **Auth / DB:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **State:** Zustand (`files-store.ts`, `ui-store.ts`) — no persistence, hydrated on layout mount
- **Realtime:** Supabase Postgres Changes (files + folders tables)
- **File previews:** Client-side only — `docx-preview`, `SheetJS/xlsx`, custom CSV/JSON/text parsers, `<iframe>` for PDF/PPTX
- **TypeScript:** strict mode

### Backend (`tdlib-service/`)
- **Runtime:** Node.js ESM, TypeScript compiled via `tsc`, `tsx` for dev
- **Framework:** Express 4
- **TDLib:** `tdl` + `prebuilt-tdlib` — bot account authenticated via `TELEGRAM_BOT_TOKEN`
- **Auth:** `X-API-Key` header checked in `middleware/auth.ts`

### Database
- **Supabase (PostgreSQL)** — stores file metadata, folders, users, shared links
- **No file content in Supabase** — all file bytes live in Telegram channel

---

## Architecture: How Files Flow

```
Upload:   Browser → Vercel /api/upload → DO TDLib service → Telegram MTProto → Telegram servers
                                         (chunks direct browser→DO for files >4 MB)

Download: Browser → Vercel /api/download OR /file/ → DO TDLib service → (cache hit: disk) OR (miss: Telegram MTProto)

Preview:  Same as download. File URL = /file/{base64url-token}/{filename}
          Images: progressive load (thumbnail placeholder → full image fade-in)
          Video: Range requests forwarded through both Vercel and DO service
```

---

## File URL Pattern

```typescript
// lib/utils.ts
getFileUrl(fileId: string, fileName: string, download?: boolean)
// → /file/{base64url(uuid)}/{fileName}?download=true
```

- `/file/[...params]/route.ts` — **public**, service-role Supabase, CORS `*`, `maxDuration=300`
- `/api/download/[...params]/route.ts` — **auth-scoped**, RLS Supabase, no CORS

---

## Download / Cache System (implemented, do not re-implement)

The TDLib service (`tdlib-service/src/routes/download.ts`) has:
1. **App-level LRU file cache** — `fileCache: Map<string, CacheEntry>` with TTL + size eviction
2. **Cache defaults for DO $12 plan:** `CACHE_MAX_SIZE_MB=512`, `CACHE_TTL_HOURS=6`, `MAX_MAP_ENTRIES=500`
3. **5-step download fallback:** local cache → TDLib sync → TDLib retry → forward-refresh → Bot API
4. **TDLib `optimizeStorage`** runs 60s after boot and every 6h, caps TDLib files at 8 GB
5. **Range header forwarding** through both Vercel routes and TDLib service (206 Partial Content)
6. **`setInterval` timers** use `.unref()` for clean shutdown

Env vars to tune (set in DigitalOcean App Platform):
```
CACHE_MAX_SIZE_MB=512
CACHE_TTL_HOURS=6
```

---

## Upload System (implemented, do not re-implement)

- Files **≤ 4 MB**: single POST `Browser → Vercel /api/upload → DO service`
- Files **> 4 MB**: chunked: `Browser → /api/upload/init → chunk direct to DO → /api/upload/complete`
- Chunk size: 10 MB, max 5 parallel chunks
- Concurrency limiter: `MAX_CONCURRENT=3` TDLib sends (separate limiters in `upload.ts` + `chunked-upload.ts` — known issue, not yet unified)
- Stagger delay: 1.5s between file uploads (Telegram flood protection)
- Dedup: name-based only (content-hash dedup not yet implemented)

---

## Known Issues / Technical Debt (do not fix unless asked)

1. **Separate concurrency limiters** in `upload.ts` and `chunked-upload.ts` — should be unified into a shared module
2. **Dedup is name-based** — SHA-256 is computed on client but not used server-side
3. **No upload resumability** — sessions are in-memory Map, lost on server restart
4. **Thumbnail endpoint** (`/api/thumbnail/:id`) downloads full file instead of true thumbnail — see `thumbnail.ts`
5. **`waitForMessageSent`** is duplicated in both upload.ts and chunked-upload.ts

---

## Coding Rules for This Project

1. **Never suggest Redis, CDN, ffmpeg, or persistent Vercel storage** — not available on this plan
2. **Never raise `CACHE_MAX_SIZE_MB` above 2048** — disk is ~25 GB total with other things on it
3. **Always use `.js` imports in `tdlib-service/`** (ESM, not `.ts`)
4. **Vercel routes that call the TDLib service** must have `export const maxDuration = 300`
5. **Always run `npx tsc --noEmit` after editing TDLib service** to verify no TypeScript errors
6. **Never delete TDLib-managed files** (in `tdlib-files/documents/`, `tdlib-files/videos/`) — only app-managed temp files (`tdlib-files/temp/botapi_*`) may be deleted
7. **Range requests** must be forwarded through both Vercel proxy routes and the TDLib download handler
8. **All `setInterval` / `setTimeout` background timers** in the TDLib service must call `.unref()`
9. **Supabase thumbnail_url column** stores base64 data-URIs — never store raw URLs there as they expire
10. **Guest sessions** use localStorage UUID with 90-day expiry — never break this flow

---

## Environment Variables Reference

### TDLib Service (DigitalOcean)
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_CHANNEL_ID=
TDLIB_SERVICE_API_KEY=        # shared secret for X-API-Key header
TDLIB_DATABASE_PATH=./tdlib-data
TDLIB_FILES_PATH=./tdlib-files
PORT=3001
CACHE_MAX_SIZE_MB=512
CACHE_TTL_HOURS=6
```

### Frontend (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TDLIB_SERVICE_URL=            # https://your-do-app.ondigitalocean.app
TDLIB_SERVICE_API_KEY=        # same value as backend
NEXT_PUBLIC_APP_URL=          # https://your-vercel-app.vercel.app
```

---

## Key File Locations (quick reference)

| File | Purpose |
|------|---------|
| `tdlib-service/src/routes/download.ts` | File cache, Range support, 5-step download fallback |
| `tdlib-service/src/routes/upload.ts` | Single-file upload, concurrency limiter |
| `tdlib-service/src/routes/chunked-upload.ts` | Chunked upload for large files |
| `tdlib-service/src/tdlib-client.ts` | TDLib singleton, bot auth, `optimizeStorage` |
| `tdlib-service/src/index.ts` | Express app, startup logging, `logDiskStats()` |
| `frontain/src/lib/telegram/download.ts` | Client wrapper for TDLib service, Range support |
| `frontain/src/lib/telegram/upload.ts` | Client wrapper for TDLib service upload |
| `frontain/src/app/api/download/[...params]/route.ts` | Auth-scoped download proxy |
| `frontain/src/app/file/[...params]/route.ts` | Public file route (CORS, service-role Supabase) |
| `frontain/src/components/preview/image-preview.tsx` | Progressive image load (thumbnail → full) |
| `frontain/src/components/preview/preview-modal.tsx` | Full-screen preview modal, all file types |
| `frontain/src/store/files-store.ts` | Zustand file/folder state |
| `frontain/src/store/ui-store.ts` | Zustand UI state (modals, preview) |
| `frontain/src/lib/realtime/use-realtime-files.ts` | Supabase realtime subscription |
| `frontain/supabase/schema.sql` | Full DB schema |
