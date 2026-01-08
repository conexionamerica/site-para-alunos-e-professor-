-- Migration: Create avatars storage bucket for profile photos
-- This bucket must be created in Supabase Storage for the avatar upload feature to work

-- Instructions to create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage in your Supabase project
-- 2. Click "New Bucket"
-- 3. Name: avatars
-- 4. Public bucket: YES (check the box)
-- 5. Click "Create bucket"

-- Alternatively, run this SQL in the SQL Editor:
-- Note: Storage bucket creation via SQL requires specific setup

-- The bucket needs to be PUBLIC so avatar images can be displayed without authentication

-- Storage policies for the avatars bucket:
-- You can add these policies in the Supabase Dashboard under Storage > avatars > Policies

-- Policy 1: Allow authenticated users to upload their own avatar
-- CREATE POLICY "Users can upload their own avatar"
-- ON storage.objects
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'avatars');

-- Policy 2: Allow public read access to all avatars
-- CREATE POLICY "Public can view avatars"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'avatars');

-- Policy 3: Allow authenticated users to update their own avatar
-- CREATE POLICY "Users can update their own avatar"
-- ON storage.objects
-- FOR UPDATE
-- TO authenticated
-- USING (bucket_id = 'avatars')
-- WITH CHECK (bucket_id = 'avatars');

SELECT 'Please create the "avatars" bucket manually in Supabase Storage Dashboard with Public access enabled.' as instruction;
