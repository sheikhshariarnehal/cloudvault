# 🗂️ CloudVault — Product Requirements Document (PRD)

**Version:** 1.1  
**Date:** March 23, 2026  
**Status:** Working Draft (Implementation-Aligned)  
**Stack:** Next.js Frontend · TDLib Service (Telegram MTProto) · Supabase (Database + Auth + Realtime)

---

## 1. Product Overview

### 1.1 Vision
CloudVault is a modern, real-time cloud file management platform that enables users to upload, organize, view, and edit files of all types without the bloat of legacy cloud drives. It leverages **Telegram as a cost-efficient storage backend via a dedicated TDLib microservice**, Supabase for metadata/auth/realtime, and Next.js for a fast, responsive UI.

### 1.2 Problem Statement
Existing cloud drives (Google Drive, Dropbox) are increasingly cluttered, slow on mobile, and require mandatory sign-up even for casual use. Users want a lightweight, modern alternative that loads fast, feels native on all screen sizes, and works immediately — even as a guest.

### 1.3 Target Users

| User Type | Description |
|-----------|-------------|
| **Guest User** | Uses the app without signing up; data is scoped to browser session/device |
| **Registered User** | Full account with persistent, cross-device storage |
| **Power User** | Heavy uploader managing folders, previews, and document editing |

---

## 2. Core Features

### 2.1 Feature Priority Matrix

| Feature | Priority | Phase |
|---------|----------|-------|
| File Upload (all types) | P0 | 1 |
| Guest Mode | P0 | 1 |
| Real-time sync | P0 | 1 |
| Folder creation & organization | P0 | 1 |
| File preview (image, video, doc) | P0 | 1 |
| Sidebar Dashboard | P0 | 1 |
| Auth (sign up / login) | P0 | 1 |
| Document editing | P1 | 2 |
| File sharing / link generation | P1 | 2 |
| Search | P1 | 2 |
| Trash / Restore | P1 | 2 |
| Storage analytics | P2 | 3 |
| Collaboration | P2 | 3 |

---

## 3. Technical Architecture

### 3.1 System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                      │
│          (App Router · Tailwind · shadcn/ui · Zustand)      │
└─────────────────────────┬────────────────────────────────────┘
                          │
               ┌──────────┴──────────┐
               │                     │
      ┌────────▼─────────┐   ┌──────▼──────────────────────┐
      │  Supabase (BaaS) │   │ TDLib Service (Node/Express)│
      │  ─ Auth (JWT)    │   │ ─ Upload/Download/Thumbnail │
      │  ─ PostgreSQL DB │   │ ─ Telegram session mgmt     │
      │  ─ Realtime WS   │   │ ─ Message cleanup endpoints │
      │  ─ Row Level Sec.│   └──────────────┬──────────────┘
      └──────────────────┘                  │
                                            ▼
                                  Telegram (Channel Storage)
```

### 3.2 Database Schema (Supabase / PostgreSQL)

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, from Supabase Auth |
| `email` | text | Unique |
| `display_name` | text | |
| `avatar_url` | text | |
| `is_guest` | boolean | Default false |
| `storage_used_bytes` | bigint | Tracked per upload |
| `created_at` | timestamptz | |

#### `files`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users.id (nullable for guests) |
| `guest_session_id` | text | For unauthenticated users |
| `folder_id` | uuid | FK → folders.id (nullable = root) |
| `name` | text | Original filename |
| `type` | text | MIME type |
| `size_bytes` | bigint | |
| `telegram_file_id` | text | Telegram file_id for retrieval |
| `telegram_message_id` | text | Message ID in the Telegram channel |
| `tdlib_file_id` | text | TDLib remote file identifier |
| `thumbnail_url` | text | For images/videos |
| `is_starred` | boolean | |
| `is_trashed` | boolean | |
| `trashed_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `folders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → users.id |
| `guest_session_id` | text | |
| `parent_id` | uuid | Self-referential FK (nullable = root) |
| `name` | text | |
| `color` | text | Hex color for UI |
| `created_at` | timestamptz | |

#### `shared_links`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `file_id` | uuid | FK → files.id |
| `token` | text | Unique URL token |
| `expires_at` | timestamptz | Nullable = no expiry |
| `created_at` | timestamptz | |

### 3.3 Storage Strategy (TDLib + Telegram)

Telegram stores files in a private channel, while a dedicated TDLib service handles MTProto upload/download and media metadata.

1. User uploads a file via the web UI
2. Next.js API receives `FormData` at `/api/upload`
3. Next.js forwards the file to `tdlib-service` with service API key auth
4. TDLib service uploads to Telegram and returns `telegram_file_id`, `telegram_message_id`, and `tdlib_file_id`
5. Next.js writes metadata to Supabase `files`
6. On retrieval, Next.js proxies download through TDLib service stream

```
User Upload -> Next.js API -> TDLib Service -> Telegram Channel -> Supabase metadata
User Download -> Next.js API -> Supabase lookup -> TDLib Service stream -> User
```

**Operational setup:**
- Private Telegram channel with bot access
- TDLib service deployed with persistent volume for session/cache
- Shared API key between frontend API routes and TDLib service

---

## 4. Application Structure (Next.js App Router)

```
/frontain/src/app
  /                        → Landing / redirect
  /auth
    /login                 → Login page
    /signup                → Signup page
  /drive               → Main dashboard (authenticated + guest)
    /layout.tsx            → Sidebar layout wrapper
    /page.tsx              → "My Drive" root
    /folder/[id]/page.tsx  → Folder contents
    /starred/page.tsx      → Starred files
    /trash/page.tsx        → Trash
    /recent/page.tsx       → Recently viewed
  /preview/[id]/page.tsx   → Full file preview
  /edit/[id]/page.tsx      → Document editor
  /share/[token]/page.tsx  → Public shared file view
/api
  /upload                  → POST: receive file → Telegram → Supabase
  /download/[id]           → GET: fetch from Telegram → stream
  /files                   → CRUD for file metadata
  /folders                 → CRUD for folders
  /share                   → Generate share links
/components
  /sidebar                 → Sidebar navigation
  /file-grid               → File/folder grid view
  /file-list               → List view
  /upload-zone             → Drag & drop upload
  /preview                 → Image, video, PDF, text preview
  /editor                  → Document editor
  /modals                  → New folder, rename, share, etc.

/tdlib-service/src
  /routes                  → Upload/download/thumbnail/message routes
  /middleware              → API key auth
  /tdlib-client.ts         → TDLib client bootstrap and operations
  /session-manager.ts      → Session and cache management
```

---

## 5. User Interface Requirements

### 5.1 Layout — Dashboard

```
┌──────────────┬────────────────────────────────────────────┐
│              │   Top Bar: Search | Upload btn | User Menu  │
│   SIDEBAR    ├────────────────────────────────────────────┤
│              │                                            │
│  ☁ CloudVault│   Breadcrumb: My Drive > Folder Name       │
│  ─────────   │                                            │
│  🏠 My Drive │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  ⭐ Starred  │   │      │ │      │ │      │ │      │    │
│  🕐 Recent  │   │ File │ │ File │ │ Fold │ │ File │    │
│  🗑 Trash   │   │      │ │      │ │  er  │ │      │    │
│  ─────────   │   └──────┘ └──────┘ └──────┘ └──────┘    │
│  📁 Folders  │                                            │
│   └ Work     │   [Grid View] | [List View]                │
│   └ Personal │                                            │
│  ─────────   │                                            │
│  Storage     │                                            │
│  [▓▓▓░░] 3GB │                                            │
│              │                                            │
│  👤 Guest    │                                            │
│     Sign Up  │                                            │
└──────────────┴────────────────────────────────────────────┘
```

### 5.2 Sidebar Sections

| Section | Description |
|---------|-------------|
| **My Drive** | Root level file/folder view |
| **Starred** | Files marked as favorites |
| **Recent** | Last 20 accessed files |
| **Trash** | Deleted files (30-day retention) |
| **Folders** | Collapsible folder tree |
| **Storage Meter** | Visual usage bar |
| **User Section** | Avatar, name, sign out (or Guest → Sign Up CTA) |

### 5.3 File Card (Grid View)
- Thumbnail for images and videos
- File type icon for docs, PDFs, etc.
- File name (truncated with tooltip)
- Last modified date
- Right-click context menu: Open · Preview · Download · Rename · Move · Star · Share · Trash

### 5.4 Top Bar
- **Search bar**: Full-text search across file names (real-time with debounce)
- **Upload button**: Opens file picker or drag-and-drop modal
- **Grid/List toggle**
- **Sort options**: Name · Date · Size · Type
- **New Folder button**
- **User avatar / Guest badge**

---

## 6. Feature Specifications

### 6.1 File Upload

**Supported types:**
- Images: JPG, PNG, GIF, WEBP, SVG, HEIC
- Videos: MP4, MOV, AVI, MKV, WEBM
- Documents: PDF, DOCX, XLSX, PPTX, TXT, MD
- Archives: ZIP, RAR
- Audio: MP3, WAV, OGG
- Code: JS, TS, PY, HTML, CSS, JSON, etc.

**Upload flow:**
1. User drags files onto the page OR clicks Upload button
2. Upload modal shows progress per file
3. Each file is sent to `/api/upload`
4. Next.js API forwards to TDLib service
5. TDLib service uploads to Telegram and returns metadata identifiers
6. Supabase record created with metadata (`telegram_file_id`, `telegram_message_id`, `tdlib_file_id`)
7. Realtime broadcast updates all open sessions

**Constraints:**
- Max single file size: 2GB (Telegram limit)
- Concurrent uploads: Up to 5 files simultaneously
- Guest upload limit: 5GB total, 10 files max (configurable)
- Large file downloads are streamed through TDLib service with range support

### 6.2 Guest Mode

**Behavior:**
- No sign-up required — user lands on dashboard immediately
- A `guest_session_id` (UUID) is generated client-side and stored in `localStorage`
- All uploaded files are tagged with this session ID in Supabase
- Files persist across browser restarts (as long as session ID is retained)
- Guest data is shown in a guest-scoped dashboard ("Guest Drive")
- A persistent, non-intrusive banner prompts sign-up to sync across devices
- Guest accounts are soft-deleted after 90 days of inactivity

**Guest limitations vs Registered:**

| Feature | Guest | Registered |
|---------|-------|------------|
| Upload files | ✅ | ✅ |
| Create folders | ✅ | ✅ |
| Preview files | ✅ | ✅ |
| Download files | ✅ | ✅ |
| Edit documents | ✅ | ✅ |
| Share via link | ❌ | ✅ |
| Cross-device sync | ❌ | ✅ |
| Starred / Recent | Local only | ✅ |
| Trash / Restore | ✅ (local) | ✅ |

### 6.3 Real-time Sync

Using **Supabase Realtime** (WebSocket channels):

- When a file is uploaded, renamed, moved, or deleted, a Supabase `INSERT`/`UPDATE` event is broadcast
- All connected clients listening to the user's channel receive the event and update the UI without a page refresh
- Implemented via `supabase.channel('user:[user_id]').on('postgres_changes', ...)` 
- Optimistic UI updates on the uploading client; confirmed by realtime event

### 6.4 Folder Management

- Create nested folders (unlimited depth)
- Drag and drop files into folders
- Right-click → Move to folder
- Breadcrumb navigation for deep folder trees
- Folder colors for visual organization
- Bulk select and move

### 6.5 File Preview

| File Type | Preview Method |
|-----------|---------------|
| Images | Full-screen lightbox with zoom/pan |
| Videos | HTML5 video player with controls |
| PDFs | Embedded PDF viewer (pdf.js) |
| Text / Markdown | Syntax-highlighted code viewer |
| Audio | In-browser audio player |
| DOCX / XLSX | Rendered via document editor or download |
| Unsupported | "No preview available" + Download button |

### 6.6 Document Editing

- Supported: `.txt`, `.md`, `.html`, `.json`, `.csv`
- Rich text editing for `.md` using **Tiptap** editor
- Plain code editing for `.json`, `.html`, `.csv` using **Monaco Editor**
- Auto-save every 30 seconds
- Save creates a new Telegram message (updated `telegram_file_id` in Supabase)
- Edit history is not versioned in Phase 1

---

## 7. Authentication & Security

### 7.1 Auth Flow (Supabase Auth)
- Email + Password
- OAuth: Google, GitHub
- Magic Link (passwordless)
- JWT session with auto-refresh

### 7.2 Row Level Security (RLS)
All Supabase tables enforce RLS:

```sql
-- files: users can only see their own files
CREATE POLICY "Users own their files"
ON files FOR ALL
USING (auth.uid() = user_id);

-- guest files: accessible only by matching session_id
CREATE POLICY "Guests own their session files"
ON files FOR ALL
USING (guest_session_id = current_setting('app.guest_session_id', true));
```

### 7.3 API Security
- All `/api/*` routes validate Supabase JWT or guest session token
- TDLib service is protected by `Authorization: Bearer <TDLIB_SERVICE_API_KEY>`
- Telegram credentials and TDLib API credentials are server-side only
- File downloads are proxied through Next.js API and TDLib service (never direct Telegram URLs)
- Rate limiting on upload endpoints: 20 requests/min per IP

---

## 8. State Management

| State | Tool |
|-------|------|
| Auth state | Supabase Auth client + React Context |
| File/folder list | Zustand store (hydrated from Supabase) |
| Upload queue | Zustand store |
| UI state (modals, view mode) | Zustand or useState |
| Realtime events | Supabase Realtime → dispatches to Zustand |

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Frontend -> TDLib Service
TDLIB_SERVICE_URL=
TDLIB_SERVICE_API_KEY=

# Telegram / TDLib Service
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
PORT=3001
TDLIB_DATABASE_PATH=/data/tdlib-db
TDLIB_FILES_PATH=/data/tdlib-files

# App
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_MAX_GUEST_STORAGE_BYTES=5368709120  # 5GB
```

---

## 10. Performance Requirements

| Metric | Target |
|--------|--------|
| Initial page load (LCP) | < 1.5s |
| File list render (100 items) | < 200ms |
| Upload initiation feedback | < 300ms |
| Realtime update latency | < 500ms |
| Image thumbnail load | < 800ms |
| Time to interactive (dashboard) | < 2s |

---

## 11. Phased Rollout

### Phase 1 — MVP (Weeks 1–6)
- Project setup (Next.js + Supabase + Tailwind)
- Auth (Email, Google OAuth)
- Guest mode
- File upload → Next.js API → TDLib service → Telegram → Supabase
- Folder creation & navigation
- Real-time sync
- File preview (images, videos, PDF, text)
- Sidebar dashboard with storage meter
- Grid + List view
- Mobile responsive layout

### Implementation Status Snapshot (March 2026)
- Core dashboard, folders, upload, preview, and trash flows implemented
- Public share page and share token APIs implemented
- `shared` dashboard view is currently a placeholder pending full listing UX
- Deployment pattern is split: frontend (Vercel) + TDLib service (container platform)

### Phase 2 — Core Features (Weeks 7–10)
- Document editor (Tiptap + Monaco)
- Trash & restore
- Starred files
- File sharing with link generation
- Search (Supabase full-text)
- Context menu actions (rename, move, copy)
- Drag and drop file movement

### Phase 3 — Polish & Scale (Weeks 11–14)
- Storage analytics dashboard
- File version history
- Bulk operations
- Keyboard shortcuts
- Progressive Web App (PWA) support
- File type filters and advanced sort
- Onboarding flow for new users

---

## 12. Success Metrics

| KPI | Target (3 months post-launch) |
|-----|-------------------------------|
| Guest → Registered conversion | > 25% |
| Daily Active Users | 500+ |
| Average session duration | > 8 min |
| Upload success rate | > 99% |
| P95 upload latency (10MB file) | < 5s |
| Real-time sync reliability | > 99.9% |

---

## 13. Out of Scope (Phase 1)

- Native mobile apps (iOS/Android)
- Collaborative document editing (multi-cursor)
- Third-party integrations (Slack, Notion, etc.)
- End-to-end encryption
- AI-powered file tagging
- Offline mode
- Admin / team management panel

---

## 14. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Telegram rate limits on uploads | High | Implement upload queue with retry logic and exponential backoff |
| Telegram media retrieval failures | Medium | Use TDLib cached file state and retry with exponential backoff |
| Supabase realtime connection drops | Medium | Auto-reconnect with full re-fetch on reconnect |
| Guest session loss (localStorage cleared) | Medium | Warn users; offer session export/import |
| Large file transfer timeouts | High | Stream uploads/downloads end-to-end; tune gateway/proxy timeouts |
| Telegram Bot Token exposure | Critical | All Telegram calls server-side only; never in client bundle |
| TDLib state loss after redeploy | High | Attach persistent volume and monitor health checks |

---

## 15. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16+ (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Auth | Supabase Auth |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Storage Gateway | TDLib Service (Node.js + Express) |
| Storage Backend | Telegram (private channel via MTProto) |
| Document Editor | Tiptap (rich text) + Monaco (code) |
| Video Player | Plyr.js / HTML5 native |
| PDF Viewer | pdf.js |
| File Handling | Multer / Next.js FormData API |
| Deployment | Frontend: Vercel · TDLib Service: container platform with persistent volume |
| Type Safety | TypeScript |

---

*CloudVault PRD v1.1 — Updated to match current implementation architecture*
