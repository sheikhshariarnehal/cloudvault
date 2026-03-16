# 🗂️ CloudVault — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** February 17, 2026  
**Status:** Draft  
**Stack:** Next.js · Supabase (Database + Auth) · Telegram (Storage Backend)

---

## 1. Product Overview

### 1.1 Vision
CloudVault is a modern, real-time cloud file management platform that enables users to upload, organize, view, and edit files of all types — without the bloat of legacy cloud drives. It leverages **Telegram's Bot API as a cost-free, scalable storage backend**, Supabase for metadata, auth, and real-time sync, and Next.js for a blazing-fast, responsive UI.

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
┌────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│         (App Router · Tailwind · shadcn/ui · Zustand)       │
└───────────────────────┬────────────────────────────────────┘
                        │
          ┌─────────────┴────────────┐
          │                          │
┌─────────▼──────────┐   ┌──────────▼──────────┐
│  Supabase (BaaS)   │   │  Telegram Bot API    │
│  ─ Auth (JWT)      │   │  ─ File Storage      │
│  ─ PostgreSQL DB   │   │  ─ file_id references│
│  ─ Realtime WS     │   │  ─ Download URLs     │
│  ─ Row Level Sec.  │   └─────────────────────┘
└────────────────────┘
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

### 3.3 Telegram Storage Strategy

Telegram allows bots to store files up to 2GB per file and retrieve them indefinitely via `file_id`. The strategy:

1. User uploads a file via the CloudVault UI
2. Next.js API Route receives the file as `FormData`
3. API forwards the file to a private Telegram channel via `sendDocument` / `sendPhoto` / `sendVideo`
4. Telegram returns a `file_id` and `message_id`
5. These references are stored in Supabase `files` table
6. On retrieval, the API calls `getFile` → gets a temporary download URL → streams back to the user

```
User Upload → Next.js API → Telegram Bot API → Supabase (stores file_id)
User Download → Next.js API → Supabase (get file_id) → Telegram getFile → Stream to user
```

**Telegram Bot Setup:**
- Create a private Telegram channel
- Add bot as admin with send/read permissions
- Store `BOT_TOKEN` and `CHANNEL_ID` in environment variables

---

## 4. Application Structure (Next.js App Router)

```
/app
  /                        → Landing / redirect
  /auth
    /login                 → Login page
    /signup                → Signup page
  /dashboard               → Main dashboard (authenticated + guest)
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
3. Files are chunked for large uploads (>50MB)
4. Each file is sent to `/api/upload`
5. API streams to Telegram Bot, receives `file_id`
6. Supabase record created with metadata
7. Realtime broadcast updates all open sessions

**Constraints:**
- Max single file size: 2GB (Telegram limit)
- Concurrent uploads: Up to 5 files simultaneously
- Guest upload limit: 5GB total, 10 files max (configurable)

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
- Telegram Bot Token never exposed to client
- File downloads are proxied through Next.js API (never direct Telegram URLs)
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

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=

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
- File upload → Telegram → Supabase
- Folder creation & navigation
- Real-time sync
- File preview (images, videos, PDF, text)
- Sidebar dashboard with storage meter
- Grid + List view
- Mobile responsive layout

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
| Telegram file_id expiry | Medium | Cache download URLs; regenerate on 404 |
| Supabase realtime connection drops | Medium | Auto-reconnect with full re-fetch on reconnect |
| Guest session loss (localStorage cleared) | Medium | Warn users; offer session export/import |
| Large file upload timeouts | High | Chunk uploads; use background API routes |
| Telegram Bot Token exposure | Critical | All Telegram calls server-side only; never in client bundle |

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
| Storage Backend | Telegram Bot API |
| Document Editor | Tiptap (rich text) + Monaco (code) |
| Video Player | Plyr.js / HTML5 native |
| PDF Viewer | pdf.js |
| File Handling | Multer / Next.js FormData API |
| Deployment | Vercel |
| Type Safety | TypeScript |

---

*CloudVault PRD v1.0 — Prepared for Engineering Review*
