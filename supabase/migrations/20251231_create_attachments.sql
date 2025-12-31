-- Migration: Create ticket attachments system
-- Description: Tables and storage setup for file attachments on tickets

-- Create attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    message_id UUID REFERENCES service_ticket_messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attachments_ticket ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON ticket_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON ticket_attachments(uploaded_by);

-- Enable RLS
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Ver anexos do ticket" ON ticket_attachments;
DROP POLICY IF EXISTS "Adicionar anexos" ON ticket_attachments;
DROP POLICY IF EXISTS "Deletar próprios anexos" ON ticket_attachments;

-- RLS Policy: View attachments from tickets you have access to
CREATE POLICY "Ver anexos do ticket"
ON ticket_attachments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM service_tickets st
        WHERE st.id = ticket_id
        AND (
            st.requester_id = auth.uid() OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
        )
    )
);

-- RLS Policy: Upload attachments to your tickets
CREATE POLICY "Adicionar anexos"
ON ticket_attachments FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM service_tickets st
        WHERE st.id = ticket_id
        AND (
            st.requester_id = auth.uid() OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
        )
    )
);

-- RLS Policy: Delete your own attachments (within 5 minutes)
CREATE POLICY "Deletar próprios anexos"
ON ticket_attachments FOR DELETE
USING (
    uploaded_by = auth.uid() AND
    created_at > NOW() - INTERVAL '5 minutes'
);

-- Function to validate file size (5MB limit)
CREATE OR REPLACE FUNCTION validate_attachment_size()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.file_size > 5242880 THEN -- 5MB in bytes
        RAISE EXCEPTION 'File size exceeds 5MB limit';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate file size
DROP TRIGGER IF EXISTS trigger_validate_attachment_size ON ticket_attachments;
CREATE TRIGGER trigger_validate_attachment_size
BEFORE INSERT ON ticket_attachments
FOR EACH ROW
EXECUTE FUNCTION validate_attachment_size();

-- Comments
COMMENT ON TABLE ticket_attachments IS 'File attachments for service tickets and messages';
COMMENT ON COLUMN ticket_attachments.file_path IS 'Storage path in Supabase Storage bucket';
COMMENT ON COLUMN ticket_attachments.file_size IS 'File size in bytes (max 5MB)';

-- NOTE: Storage bucket needs to be created manually in Supabase Dashboard:
-- Name: ticket-attachments
-- Public: false
-- File size limit: 5MB
-- Allowed MIME types: image/*, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- Verification
SELECT 'Ticket attachments table created successfully' AS message;
