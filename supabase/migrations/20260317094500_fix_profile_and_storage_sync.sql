-- Fix profile metadata sync and storage_used_bytes maintenance

-- Keep public.users profile synced from auth metadata on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate storage usage from non-trashed files for a single user.
CREATE OR REPLACE FUNCTION public.recalculate_user_storage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.users u
  SET
    storage_used_bytes = COALESCE((
      SELECT SUM(f.size_bytes)::BIGINT
      FROM public.files f
      WHERE f.user_id = p_user_id
        AND COALESCE(f.is_trashed, FALSE) = FALSE
    ), 0),
    updated_at = NOW()
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to keep storage_used_bytes in sync with files lifecycle changes.
CREATE OR REPLACE FUNCTION public.files_storage_sync_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_user_storage(NEW.user_id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM public.recalculate_user_storage(OLD.user_id);
      PERFORM public.recalculate_user_storage(NEW.user_id);
      RETURN NULL;
    END IF;

    IF OLD.size_bytes IS DISTINCT FROM NEW.size_bytes
      OR OLD.is_trashed IS DISTINCT FROM NEW.is_trashed THEN
      PERFORM public.recalculate_user_storage(NEW.user_id);
    END IF;

    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_user_storage(OLD.user_id);
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_files_storage_sync ON public.files;
CREATE TRIGGER trg_files_storage_sync
AFTER INSERT OR UPDATE OR DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.files_storage_sync_trigger();

-- One-time backfill to fix already incorrect rows.
UPDATE public.users u
SET
  storage_used_bytes = COALESCE(calc.actual_bytes, 0),
  updated_at = NOW()
FROM (
  SELECT
    user_id,
    SUM(size_bytes)::BIGINT AS actual_bytes
  FROM public.files
  WHERE user_id IS NOT NULL
    AND COALESCE(is_trashed, FALSE) = FALSE
  GROUP BY user_id
) AS calc
WHERE u.id = calc.user_id
  AND u.storage_used_bytes IS DISTINCT FROM calc.actual_bytes;

-- Ensure users with no files are set to 0.
UPDATE public.users u
SET
  storage_used_bytes = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.files f
  WHERE f.user_id = u.id
    AND COALESCE(f.is_trashed, FALSE) = FALSE
)
AND u.storage_used_bytes IS DISTINCT FROM 0;
