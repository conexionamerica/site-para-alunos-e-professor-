-- Function to FORCE sync emails from auth.users to profiles.real_email
CREATE OR REPLACE FUNCTION force_sync_emails()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated_rows AS (
    UPDATE public.profiles p
    SET real_email = u.email,
        email = COALESCE(p.email, u.email)
    FROM auth.users u
    WHERE p.id = u.id
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM updated_rows;
  
  RETURN 'Updated ' || updated_count || ' profiles.';
END;
$$;
