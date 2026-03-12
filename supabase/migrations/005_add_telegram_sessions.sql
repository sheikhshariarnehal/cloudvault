-- Migration: Add per-user Telegram session support
-- Each authenticated user can connect their own Telegram account.
-- Files track which storage backend they reside on (bot channel vs user Saved Messages).

-- ── Users table: Telegram account fields ─────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS telegram_phone       TEXT,
  ADD COLUMN IF NOT EXISTS telegram_user_id     BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_connected   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_connected_at TIMESTAMPTZ;

-- ── Files table: storage routing fields ──────────────────────────────────────
-- storage_type: 'bot' (legacy / guest) or 'user' (user's own Telegram account)
-- telegram_chat_id: the chat where the file physically lives
--   • For bot files: the shared channel ID
--   • For user files: the user's Saved Messages chat ID
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS storage_type      TEXT DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS telegram_chat_id  BIGINT;

-- Backfill existing files: all current files are bot-channel files
-- Set their telegram_chat_id to NULL (the backend resolves it from TELEGRAM_CHANNEL_ID env var)
-- storage_type already defaults to 'bot', no update needed.

-- Index for filtering by storage type
CREATE INDEX IF NOT EXISTS idx_files_storage_type ON public.files (storage_type);
