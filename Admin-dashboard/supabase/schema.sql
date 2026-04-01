-- CloudVault Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 107374182400, -- 100 GB default
  is_premium BOOLEAN DEFAULT FALSE,
  guest_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  folder_id UUID,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  telegram_file_id TEXT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  thumbnail_url TEXT,
  file_hash TEXT,
  is_starred BOOLEAN DEFAULT FALSE,
  is_trashed BOOLEAN DEFAULT FALSE,
  trashed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  guest_session_id TEXT,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#EAB308',
  is_trashed BOOLEAN DEFAULT FALSE,
  trashed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for folder_id in files
ALTER TABLE public.files
  ADD CONSTRAINT fk_folder
  FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL;

-- Shared links table (supports both file and folder sharing)
CREATE TABLE IF NOT EXISTS public.shared_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ,
  is_password_protected BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_shared_links_target CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL)
    OR (file_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_guest_session ON public.files(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_is_trashed ON public.files(is_trashed);
CREATE INDEX IF NOT EXISTS idx_files_file_hash ON public.files(file_hash) WHERE file_hash IS NOT NULL AND is_trashed = FALSE;
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_guest_session ON public.folders(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON public.shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_folder_id ON public.shared_links(folder_id);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Files RLS (authenticated users see own files; guest files accessible via anon role)
CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can update own files"
  ON public.files FOR UPDATE
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

-- Folders RLS
CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (
    (auth.uid() = user_id) 
    OR (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

-- Shared Links RLS
CREATE POLICY "Users can view own shared links"
  ON public.shared_links FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create shared links"
  ON public.shared_links FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own shared links"
  ON public.shared_links FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own shared links"
  ON public.shared_links FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Anyone can view active shared links by token"
  ON public.shared_links FOR SELECT
  USING (is_active = TRUE);

-- Auto-create public.users profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper function to increment storage
CREATE OR REPLACE FUNCTION increment_storage(user_id_param UUID, bytes_param BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET storage_used_bytes = storage_used_bytes + bytes_param,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for files and folders
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
