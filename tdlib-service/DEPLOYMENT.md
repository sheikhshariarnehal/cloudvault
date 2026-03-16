# CloudVault — Full Deployment Guide

> **Backend** (`tdlib-service`) → DigitalOcean App Platform  
> **Frontend** (`frontain`) → Vercel

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Prepare the Repository](#2-prepare-the-repository)
3. [Deploy Backend to DigitalOcean](#3-deploy-backend-to-digitalocean)
4. [Deploy Frontend to Vercel](#4-deploy-frontend-to-vercel)
5. [Post-Deployment Checks](#5-post-deployment-checks)
6. [Environment Variable Reference](#6-environment-variable-reference)
7. [Persistent Storage Notes](#7-persistent-storage-notes)
8. [Redeployment & CI/CD](#8-redeployment--cicd)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Purpose | Link |
|------|---------|-------|
| GitHub account | Host your repo for automatic deploys | https://github.com |
| DigitalOcean account | Host the TDLib backend container | https://cloud.digitalocean.com |
| Vercel account | Host the Next.js frontend | https://vercel.com |
| Telegram bot token | Already in your `.env` | https://t.me/BotFather |
| Telegram API ID + Hash | Already in your `.env` | https://my.telegram.org |
| Supabase project | Already set up | https://supabase.com |

**Your secrets you will need on hand:**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_CHANNEL_ID`
- `TDLIB_SERVICE_API_KEY` — pick any strong random string, e.g. `openssl rand -hex 32`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Prepare the Repository

Your project must be in a single GitHub repository. If it is not already, run this once:

```bash
cd D:\Poject\cloudvault\MAIN
git init
git add .
git commit -m "initial commit"
```

Push to GitHub:

```bash
git remote add origin https://github.com/<YOUR_USERNAME>/cloudvault.git
git branch -M main
git push -u origin main
```

> **Monorepo layout expected by the guides below:**
>
> ```
> /                     ← repo root
> ├── tdlib-service/    ← backend (Dockerfile lives here)
> └── frontain/         ← Next.js frontend
> ```

---

## 3. Deploy Backend to DigitalOcean

The `tdlib-service` uses a multi-stage `Dockerfile` and needs **persistent disk** for TDLib's SQLite database. DigitalOcean App Platform supports both.

### 3.1 — Create a New App

1. Go to [https://cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Click **Create App**
3. Choose **GitHub** as the source → Authorize DigitalOcean
4. Select your `cloudvault` repository, branch `main`
5. DigitalOcean will detect the Dockerfile automatically

### 3.2 — Configure the Service

In the **Resources** step:

| Setting | Value |
|---------|-------|
| **Source Directory** | `/tdlib-service` |
| **Dockerfile path** | `tdlib-service/Dockerfile` |
| **HTTP Port** | `3001` |
| **Health Check Path** | `/health` |

> If DigitalOcean does not auto-detect, choose **Docker Hub / Dockerfile** and point it at `tdlib-service/Dockerfile`.

**Plan size:** Choose at minimum the **Basic — 1 vCPU / 1 GB RAM** plan. TDLib loads a native binary and needs some memory headroom. **$12/mo** plan is sufficient for personal use.

### 3.3 — Add a Persistent Volume

TDLib stores its SQLite session database on disk. If the container restarts without a volume, you lose the bot session and must re-authenticate.

In the **Resources → Edit** panel for your service:

1. Scroll to **Storage**
2. Click **Attach a Volume**
3. Set:
   - **Mount path:** `/data`
   - **Size:** 5 GB (adjustable later)

This maps to the paths already set in the Dockerfile:
```
TDLIB_DATABASE_PATH=/data/tdlib-db
TDLIB_FILES_PATH=/data/tdlib-files
```

### 3.4 — Set Environment Variables

In the **Environment Variables** step, add **all** of the following:

| Variable | Value | Encrypted? |
|----------|-------|-----------|
| `TELEGRAM_BOT_TOKEN` | `<your bot token>` | ✅ Yes |
| `TELEGRAM_API_ID` | `<your api id>` | ✅ Yes |
| `TELEGRAM_API_HASH` | `<your api hash>` | ✅ Yes |
| `TELEGRAM_CHANNEL_ID` | `-100xxxxxxxxxx` | ✅ Yes |
| `TDLIB_SERVICE_API_KEY` | `<random strong secret>` | ✅ Yes |
| `PORT` | `3001` | No |
| `TDLIB_DATABASE_PATH` | `/data/tdlib-db` | No |
| `TDLIB_FILES_PATH` | `/data/tdlib-files` | No |

> Mark all tokens and secrets as **Encrypted** so they are stored securely and hidden in logs.

### 3.5 — Review & Deploy

1. Click **Next** through remaining steps
2. Give the app a name: `cloudvault-tdlib`
3. Click **Create Resources**

DigitalOcean will build the Docker image (5–10 min) and deploy it.

### 3.6 — Get the Backend URL

After deployment, navigate to your app's **Overview** tab. You will see a public URL like:

```
https://cloudvault-tdlib-<random>.ondigitalocean.app
```

**Save this URL** — you will need it as `TDLIB_SERVICE_URL` in the frontend.

### 3.7 — Verify the Backend

Open in your browser or run:

```bash
curl https://cloudvault-tdlib-<random>.ondigitalocean.app/health
```

Expected response:
```json
{
  "status": "ok",
  "tdlib_ready": true,
  "uptime": 42.5,
  "timestamp": "2026-02-19T10:00:00.000Z"
}
```

> `tdlib_ready: true` means TDLib has authenticated with Telegram and is ready.  
> If it shows `false`, wait ~30 seconds and retry — TDLib initialization takes a moment on first boot.

---

## 4. Deploy Frontend to Vercel

### 4.1 — Import the Project

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your `cloudvault` repo
3. Vercel will detect Next.js automatically

### 4.2 — Configure the Project

In the **Configure Project** screen:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Next.js (auto-detected) |
| **Root Directory** | `frontain` |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `.next` (default) |
| **Install Command** | `npm install` (default) |

> **Root Directory is critical.** Click **Edit** and type `frontain`. This tells Vercel to treat the `frontain/` folder as the project root.

### 4.3 — Set Environment Variables

Expand **Environment Variables** and add all of the following. Set each to apply to **Production**, **Preview**, and **Development**:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | From Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | From Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | From Supabase → Project Settings → API — **never expose to client** |
| `TDLIB_SERVICE_URL` | `https://cloudvault-tdlib-<random>.ondigitalocean.app` | The URL from Step 3.6 |
| `TDLIB_SERVICE_API_KEY` | `<same secret as backend>` | Must match `TDLIB_SERVICE_API_KEY` on DigitalOcean |

### 4.4 — Deploy

Click **Deploy**. Vercel will install dependencies, build, and deploy (2–4 min).

Your frontend URL will be:
```
https://cloudvault-<your-username>.vercel.app
```

### 4.5 — Set a Custom Domain (Optional)

1. In Vercel → your project → **Settings → Domains**
2. Add your domain, e.g. `cloudvault.yourdomain.com`
3. Follow the DNS instructions Vercel provides

---

## 5. Post-Deployment Checks

Run through these after both services are live:

- [ ] `GET /health` on the DigitalOcean URL returns `tdlib_ready: true`
- [ ] Frontend loads at the Vercel URL without console errors
- [ ] Login with Supabase works (email/password or OAuth)
- [ ] Upload a small file — verify it appears in the dashboard
- [ ] Download the file — verify it streams back correctly
- [ ] Check Supabase → Table Editor → `files` table for the record

---

## 6. Environment Variable Reference

### Backend (`tdlib-service`) — DigitalOcean

```env
# Required — Telegram credentials
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_API_ID=<numeric_api_id>
TELEGRAM_API_HASH=<api_hash_string>
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx

# Required — Shared secret (must match frontend)
TDLIB_SERVICE_API_KEY=<random_hex_secret>

# Service config (defaults are fine for DigitalOcean App Platform)
PORT=3001
TDLIB_DATABASE_PATH=/data/tdlib-db
TDLIB_FILES_PATH=/data/tdlib-files
```

### Frontend (`frontain`) — Vercel

```env
# Supabase — public keys are safe in the browser
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase — service role key is server-only (no NEXT_PUBLIC_ prefix)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Backend service — server-only (no NEXT_PUBLIC_ prefix)
TDLIB_SERVICE_URL=https://cloudvault-tdlib-<random>.ondigitalocean.app
TDLIB_SERVICE_API_KEY=<same_random_hex_secret>
```

---

## 7. Persistent Storage Notes

TDLib **requires persistent disk** to:
- Store the SQLite session file (`td.binlog`)
- Cache downloaded file chunks

Without a volume, every container restart means TDLib re-authenticates from scratch (takes 30–60 seconds) and previously cached files are lost.

**DigitalOcean App Platform Volume:**
- Provisioned in Step 3.3, mounted at `/data`
- Survives deploys and container restarts
- Billed at ~$0.10/GB/month

**What lives on the volume:**
```
/data/
├── tdlib-db/      ← SQLite database + TDLib session
└── tdlib-files/   ← Temporary file cache for streaming
```

---

## 8. Redeployment & CI/CD

### Automatic (Recommended)

Both platforms support auto-deploy on `git push`:

- **DigitalOcean:** In App → Settings → **Auto Deploy** → On (default)
- **Vercel:** Enabled by default for every push to `main`

Your workflow:
```bash
git add .
git commit -m "feat: ..."
git push origin main
# Both platforms redeploy automatically
```

### Manual Redeploy

- **DigitalOcean:** App → **Actions → Force Rebuild and Deploy**
- **Vercel:** Deployments tab → **Redeploy**

### Environment Variable Updates

Changing an env var requires a redeploy:
- DigitalOcean: App → Settings → App-Level Env Vars → Edit → **Save** (triggers rebuild)
- Vercel: Project → Settings → Environment Variables → Edit → **Redeploy**

---

## 9. Troubleshooting

### Backend: `tdlib_ready: false` stays permanently

TDLib failed to authenticate. Check:
1. App Platform logs: **Runtime Logs** tab
2. Verify `TELEGRAM_BOT_TOKEN`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` are correct
3. Verify the bot has been added to the `TELEGRAM_CHANNEL_ID` channel as an admin
4. If the volume is new, TDLib needs ~60s on first boot to create the session

### Backend: Container keeps restarting

1. Check **Runtime Logs** for the error
2. Most common cause: missing env var → service throws on startup
3. Verify all 5 required env vars are set

### Frontend: Uploads fail with `401` or `403`

- `TDLIB_SERVICE_API_KEY` in Vercel does not match the one on DigitalOcean
- Fix: Copy the exact same value to both platforms and redeploy

### Frontend: Uploads fail with `Network Error` or `ECONNREFUSED`

- `TDLIB_SERVICE_URL` is wrong or the DigitalOcean service is down
- Verify the URL (no trailing slash) and test `curl <url>/health`

### Frontend: Supabase auth returns `Invalid API key`

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` is wrong
- Copy fresh values from Supabase → Project Settings → API

### Vercel: Build fails with `Module not found`

- Root Directory was not set to `frontain`
- Fix: Vercel → Project → Settings → General → **Root Directory** → set to `frontain`

### DigitalOcean: Build fails at Docker step

Common causes:
- Out of memory during `npm install` → Upgrade to a larger build worker in App Spec
- `libssl` missing → Already handled in the Dockerfile, double-check the `Dockerfile` includes the `apt-get install` lines

---

## Quick Reference — URLs & Keys

Fill in this table after deployment and store it securely (e.g. in 1Password):

| Item | Value |
|------|-------|
| DigitalOcean backend URL | `https://cloudvault-tdlib-????.ondigitalocean.app` |
| Vercel frontend URL | `https://cloudvault-????.vercel.app` |
| Supabase project URL | `https://????.supabase.co` |
| `TDLIB_SERVICE_API_KEY` | `<your secret>` |
| `TELEGRAM_BOT_TOKEN` | `<keep private>` |
