-- Migration: Add TDLib support columns
-- Run this in your Supabase SQL editor if you have an existing database.
-- New databases using schema.sql already have these columns.

-- Add TDLib numeric file ID for faster lookups (skip getRemoteFile call)
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS tdlib_file_id INTEGER;

-- Create index for TDLib file ID lookups
CREATE INDEX IF NOT EXISTS idx_files_tdlib_file_id ON public.files(tdlib_file_id)
  WHERE tdlib_file_id IS NOT NULL;

-- NOTE: Existing rows with telegram_file_id still work.
-- TDLib's getRemoteFile can resolve Bot API file_id strings.
-- No data migration needed — new uploads will populate tdlib_file_id automatically.
