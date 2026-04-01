-- Migration 003: Fix auth - add user profile trigger + improve RLS policies
-- This migration fixes the critical issue where auth users had no public.users profile

-- 1. Create trigger function to auto-create public.users profile on auth signup
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

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Add INSERT policy on public.users (for client-side profile creation fallback)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'users') THEN
    CREATE POLICY "Users can insert own profile"
      ON public.users FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 4. Fix RLS policies for files: make guest file access more restrictive
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
DROP POLICY IF EXISTS "Users can update own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.files;

CREATE POLICY "Users can view own files" ON public.files FOR SELECT
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can insert own files" ON public.files FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can update own files" ON public.files FOR UPDATE
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can delete own files" ON public.files FOR DELETE
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

-- 5. Fix RLS policies for folders
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;

CREATE POLICY "Users can view own folders" ON public.folders FOR SELECT
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can insert own folders" ON public.folders FOR INSERT
  WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can update own folders" ON public.folders FOR UPDATE
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

CREATE POLICY "Users can delete own folders" ON public.folders FOR DELETE
  USING ((auth.uid() = user_id) OR (user_id IS NULL AND guest_session_id IS NOT NULL));

-- 6. Add shared_links UPDATE and DELETE policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own shared links' AND tablename = 'shared_links') THEN
    CREATE POLICY "Users can update own shared links"
      ON public.shared_links FOR UPDATE
      USING (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own shared links' AND tablename = 'shared_links') THEN
    CREATE POLICY "Users can delete own shared links"
      ON public.shared_links FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- 7. Backfill public.users profiles for existing auth.users who are missing them
INSERT INTO public.users (id, email, display_name, avatar_url)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
