-- Function to sync emails from auth.users to profiles.real_email
CREATE OR REPLACE FUNCTION sync_emails_to_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET real_email = u.email
  FROM auth.users u
  WHERE p.id = u.id 
  AND (p.real_email IS NULL OR p.real_email = '');
END;
$$;
