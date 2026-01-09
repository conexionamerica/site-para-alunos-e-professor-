-- Create storage bucket for shared materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-materials', 'shared-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for shared-materials bucket
CREATE POLICY "Professors can upload materials"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shared-materials'
  AND (storage.foldername(name))[1] = 'professor-materials'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'professor'
  )
);

CREATE POLICY "Professors can update own materials"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'shared-materials'
  AND (storage.foldername(name))[1] = 'professor-materials'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'professor'
  )
);

CREATE POLICY "Professors can delete own materials"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'shared-materials'
  AND (storage.foldername(name))[1] = 'professor-materials'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'professor'
  )
);

CREATE POLICY "Everyone can view materials"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'shared-materials');

-- Admins can do everything
CREATE POLICY "Admins can manage all materials"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'shared-materials'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
