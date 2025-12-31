-- Migration: Create Service Tickets System
-- Description: Tables for professor service requests and support tickets

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: service_tickets
CREATE TABLE IF NOT EXISTS service_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES profiles(id)
);

-- Table: service_ticket_messages
CREATE TABLE IF NOT EXISTS service_ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_internal BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_tickets_requester ON service_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_created ON service_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON service_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created ON service_ticket_messages(created_at);

-- Enable Row Level Security
ALTER TABLE service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Professores veem seus tickets" ON service_tickets;
DROP POLICY IF EXISTS "Professores criam tickets" ON service_tickets;
DROP POLICY IF EXISTS "Admins atualizam tickets" ON service_tickets;
DROP POLICY IF EXISTS "Ver mensagens do ticket" ON service_ticket_messages;
DROP POLICY IF EXISTS "Enviar mensagens" ON service_ticket_messages;

-- RLS Policy: Professors see only their tickets, admins see all
CREATE POLICY "Professores veem seus tickets"
ON service_tickets FOR SELECT
USING (
    auth.uid() = requester_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);

-- RLS Policy: Professors can create tickets
CREATE POLICY "Professores criam tickets"
ON service_tickets FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- RLS Policy: Only admins can update tickets
CREATE POLICY "Admins atualizam tickets"
ON service_tickets FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- RLS Policy: Users see messages from their tickets (except internal messages)
CREATE POLICY "Ver mensagens do ticket"
ON service_ticket_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM service_tickets st
        WHERE st.id = ticket_id
        AND (
            st.requester_id = auth.uid() OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
        )
    )
    AND (
        NOT is_internal OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    )
);

-- RLS Policy: Send messages to tickets user has access to
CREATE POLICY "Enviar mensagens"
ON service_ticket_messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM service_tickets st
        WHERE st.id = ticket_id
        AND (st.requester_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'))
    )
);

-- Function: Generate unique ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 0;
BEGIN
    LOOP
        new_number := '#' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 7);
        
        -- Check if number already exists
        IF NOT EXISTS (SELECT 1 FROM service_tickets WHERE ticket_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
        IF counter > 100 THEN
            RAISE EXCEPTION 'Could not generate unique ticket number after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Set ticket number on insert
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
        NEW.ticket_number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_set_ticket_number ON service_tickets;

-- Create trigger
CREATE TRIGGER trigger_set_ticket_number
BEFORE INSERT ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_number();

-- Trigger function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_ticket_timestamp ON service_tickets;

-- Create trigger
CREATE TRIGGER trigger_update_ticket_timestamp
BEFORE UPDATE ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION update_ticket_timestamp();

-- Comment on tables
COMMENT ON TABLE service_tickets IS 'Service tickets created by professors for support and requests';
COMMENT ON TABLE service_ticket_messages IS 'Messages/history for service tickets';

-- Verification query
SELECT 'Service Tickets tables created successfully' AS message;
