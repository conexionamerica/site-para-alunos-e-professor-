-- Function to debug and fix emails
CREATE OR REPLACE FUNCTION debug_fix_emails()
RETURNS TABLE (
  profile_id uuid,
  profile_username text,
  auth_email varchar,
  old_real_email text,
  new_real_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    UPDATE public.profiles p
    SET real_email = u.email
    FROM auth.users u
    WHERE p.id = u.id
    AND p.real_email IS NULL
    RETURNING p.id, p.username, u.email as auth_email, p.real_email as old_val, u.email as new_val
  )
  SELECT id, username, auth_email, old_val, new_val FROM updated;
END;
$$;
