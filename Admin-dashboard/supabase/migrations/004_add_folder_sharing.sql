-- Migration: Add folder sharing support
-- Make file_id nullable and add folder_id to shared_links

-- 1. Make file_id nullable (it was NOT NULL before)
ALTER TABLE public.shared_links
  ALTER COLUMN file_id DROP NOT NULL;

-- 2. Add folder_id column
ALTER TABLE public.shared_links
  ADD COLUMN folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

-- 3. Add a check constraint: exactly one of file_id or folder_id must be set
ALTER TABLE public.shared_links
  ADD CONSTRAINT chk_shared_links_target
  CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL)
    OR (file_id IS NULL AND folder_id IS NOT NULL)
  );

-- 4. Index for folder_id lookups
CREATE INDEX IF NOT EXISTS idx_shared_links_folder_id ON public.shared_links(folder_id);
