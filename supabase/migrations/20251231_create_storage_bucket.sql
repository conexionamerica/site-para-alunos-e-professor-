-- Create Storage Bucket via SQL (alternativa ao dashboard)
-- Bucket para anexos de tickets

-- Inserir bucket na tabela storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ticket-attachments',
    'ticket-attachments',
    false, -- privado
    5242880, -- 5MB em bytes
    ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies para o bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload to their tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their ticket attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own recent uploads" ON storage.objects;

-- Policy: Upload files
CREATE POLICY "Users can upload to their tickets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'ticket-attachments' AND
    auth.uid() IS NOT NULL
);

-- Policy: View files from accessible tickets
CREATE POLICY "Users can view their ticket attachments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'ticket-attachments' AND
    auth.uid() IS NOT NULL
);

-- Policy: Delete own files (within 5 minutes)
CREATE POLICY "Users can delete own recent uploads"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'ticket-attachments' AND
    owner = auth.uid() AND
    created_at > NOW() - INTERVAL '5 minutes'
);

-- Verification
SELECT 'Storage bucket for ticket attachments configured successfully' AS message;
