-- Migration: Add file_hash column for content deduplication
-- Allows skipping re-upload when an identical file already exists in Telegram.

-- Add SHA-256 file hash column
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Index for fast dedup lookups — only non-trashed files with a hash
CREATE INDEX IF NOT EXISTS idx_files_file_hash
  ON public.files (file_hash)
  WHERE file_hash IS NOT NULL AND is_trashed = FALSE;

-- NOTE: Existing files will have NULL file_hash.
-- Only new uploads will populate the hash for dedup matching.
