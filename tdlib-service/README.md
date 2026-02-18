# CloudVault TDLib Service

A TDLib-powered microservice that handles Telegram file storage operations via the MTProto protocol. This replaces the direct Telegram Bot API calls in the main CloudVault app, providing:

- **2GB downloads** (Bot API `getFile` caps at 20MB)
- **Persistent thumbnails** (no more expiring URLs)
- **Message deletion** (clean up channel when files are trashed)
- **Range request support** (video seeking, resumable downloads)
- **Better reliability** (TDLib manages connections, retries, and caching)

## Setup

### 1. Get Telegram API Credentials

Go to [my.telegram.org](https://my.telegram.org) and create an application to get:
- `api_id` (numeric)
- `api_hash` (string)

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in your `.env`:
```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=-100xxxxxxxxxx
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_here
TDLIB_SERVICE_API_KEY=generate_a_strong_random_key
PORT=3001
```

### 3. Install & Run

```bash
npm install
npm run dev    # Development with hot reload
npm run build  # Build for production
npm start      # Production
```

### 4. Deploy to Railway

1. Push this folder as a separate repo (or monorepo subfolder)
2. Connect to Railway → New Project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. **Add a persistent volume** mounted at `/data` (critical for TDLib session)
5. Deploy

## API Endpoints

All endpoints (except `/health`) require:
```
Authorization: Bearer <TDLIB_SERVICE_API_KEY>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth) |
| POST | `/api/upload` | Upload file to Telegram channel |
| GET | `/api/download/:remoteFileId` | Download file via MTProto |
| GET | `/api/download/status/:remoteFileId` | Check download/cache status |
| GET | `/api/thumbnail/:remoteFileId` | Get persistent thumbnail |
| POST | `/api/thumbnail/from-message` | Get thumbnail from message |
| DELETE | `/api/message/:chatId/:messageId` | Delete message from channel |
| POST | `/api/message/cleanup` | Bulk delete messages |

## Architecture

```
Vercel (Next.js) ──HTTP──▶ Railway (TDLib Service) ──MTProto──▶ Telegram
     │                              │
     ▼                              ▼
  Supabase                    TDLib Session DB
  (metadata)                  (persistent volume)
```
