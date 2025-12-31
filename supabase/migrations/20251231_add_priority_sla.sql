-- Migration: Add Priority and SLA fields to service tickets
-- Description: Adds priority levels, SLA tracking, and response time metrics

-- Add new columns to service_tickets
ALTER TABLE service_tickets
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    ADD COLUMN IF NOT EXISTS expected_response_hours INTEGER DEFAULT 24,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_violated BOOLEAN DEFAULT FALSE;

-- Create index for priority and status queries
CREATE INDEX IF NOT EXISTS idx_tickets_priority_status ON service_tickets(priority, status);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON service_tickets(sla_violated, status) WHERE sla_violated = TRUE;

-- Function to set expected response time based on priority
CREATE OR REPLACE FUNCTION set_expected_response_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Set expected response hours based on priority
    CASE NEW.priority
        WHEN 'urgent' THEN NEW.expected_response_hours := 4;
        WHEN 'high' THEN NEW.expected_response_hours := 12;
        WHEN 'medium' THEN NEW.expected_response_hours := 24;
        WHEN 'low' THEN NEW.expected_response_hours := 48;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set expected response time
DROP TRIGGER IF EXISTS trigger_set_expected_response ON service_tickets;
CREATE TRIGGER trigger_set_expected_response
BEFORE INSERT OR UPDATE OF priority ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION set_expected_response_time();

-- Function to check SLA violations
CREATE OR REPLACE FUNCTION check_sla_violation()
RETURNS TRIGGER AS $$
DECLARE
    hours_elapsed NUMERIC;
BEGIN
    -- Only check for open/awaiting_user tickets
    IF NEW.status IN ('open', 'awaiting_user', 'pending') AND NEW.status != 'closed' THEN
        -- Calculate hours since creation
        hours_elapsed := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 3600;
        
        -- If no first response yet, check if SLA is violated
        IF NEW.first_response_at IS NULL THEN
            IF hours_elapsed > NEW.expected_response_hours THEN
                NEW.sla_violated := TRUE;
            ELSE
                NEW.sla_violated := FALSE;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check SLA on updates
DROP TRIGGER IF EXISTS trigger_check_sla ON service_tickets;
CREATE TRIGGER trigger_check_sla
BEFORE UPDATE ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION check_sla_violation();

-- Function to set first_response_at when first message is added
CREATE OR REPLACE FUNCTION set_first_response()
RETURNS TRIGGER AS $$
DECLARE
    ticket_record RECORD;
    is_admin BOOLEAN;
BEGIN
    -- Get ticket info
    SELECT * INTO ticket_record FROM service_tickets WHERE id = NEW.ticket_id;
    
    -- Check if sender is admin
    SELECT role = 'superadmin' INTO is_admin FROM profiles WHERE id = NEW.user_id;
    
    -- If this is the first response from admin and ticket has no first_response_at
    IF is_admin AND ticket_record.first_response_at IS NULL AND NEW.user_id != ticket_record.requester_id THEN
        UPDATE service_tickets 
        SET first_response_at = NEW.created_at
        WHERE id = NEW.ticket_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set first response time
DROP TRIGGER IF EXISTS trigger_set_first_response ON service_ticket_messages;
CREATE TRIGGER trigger_set_first_response
AFTER INSERT ON service_ticket_messages
FOR EACH ROW
EXECUTE FUNCTION set_first_response();

-- Function to set resolved_at when ticket is closed
CREATE OR REPLACE FUNCTION set_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        NEW.resolved_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set resolved_at
DROP TRIGGER IF EXISTS trigger_set_resolved_at ON service_tickets;
CREATE TRIGGER trigger_set_resolved_at
BEFORE UPDATE OF status ON service_tickets
FOR EACH ROW
EXECUTE FUNCTION set_resolved_at();

-- Comments
COMMENT ON COLUMN service_tickets.priority IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN service_tickets.expected_response_hours IS 'Expected response time in hours based on priority';
COMMENT ON COLUMN service_tickets.first_response_at IS 'Timestamp of first admin response';
COMMENT ON COLUMN service_tickets.resolved_at IS 'Timestamp when ticket was closed';
COMMENT ON COLUMN service_tickets.sla_violated IS 'Whether SLA was violated (no response within expected time)';

-- Verification
SELECT 'Priority and SLA fields added successfully' AS message;
