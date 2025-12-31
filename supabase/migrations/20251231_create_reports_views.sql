-- Migration: Create views and functions for ticket reports
-- Description: Analytics views and aggregations for ticket reporting

-- View: Overall ticket statistics (last 30 days)
CREATE OR REPLACE VIEW ticket_stats AS
SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'open') as open_count,
    COUNT(*) FILTER (WHERE status = 'awaiting_user') as awaiting_user_count,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    COUNT(*) FILTER (WHERE sla_violated = true) as sla_violations,
    ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric, 2) as avg_resolution_hours,
    ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600)::numeric, 2) as avg_first_response_hours,
    ROUND((COUNT(*) FILTER (WHERE status = 'closed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as resolution_rate_percent
FROM service_tickets
WHERE created_at >= NOW() - INTERVAL '30 days';

-- View: Tickets by type (last 30 days)
CREATE OR REPLACE VIEW tickets_by_type AS
SELECT 
    type,
    COUNT(*) as ticket_count,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    ROUND((COUNT(*) FILTER (WHERE status = 'closed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as resolution_rate
FROM service_tickets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY ticket_count DESC;

-- View: Tickets by priority (last 30 days)
CREATE OR REPLACE VIEW tickets_by_priority AS
SELECT 
    priority,
    COUNT(*) as ticket_count,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    COUNT(*) FILTER (WHERE sla_violated = true) as sla_violations,
    ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric, 2) as avg_resolution_hours
FROM service_tickets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY priority
ORDER BY 
    CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- View: Tickets by requester (last 30 days)
CREATE OR REPLACE VIEW tickets_by_requester AS
SELECT 
    p.id as professor_id,
    p.full_name as professor_name,
    COUNT(st.*) as ticket_count,
    COUNT(*) FILTER (WHERE st.status = 'closed') as closed_count,
    COUNT(*) FILTER (WHERE st.status = 'pending') as pending_count,
    MAX(st.created_at) as last_ticket_date
FROM service_tickets st
JOIN profiles p ON st.requester_id = p.id
WHERE st.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.full_name
ORDER BY ticket_count DESC;

-- View: Daily ticket creation trend (last 30 days)
CREATE OR REPLACE VIEW daily_ticket_trend AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as tickets_created,
    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
    COUNT(*) FILTER (WHERE priority = 'high') as high_count
FROM service_tickets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Function: Get ticket metrics for a specific date range
CREATE OR REPLACE FUNCTION get_ticket_metrics(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS TABLE (
    total_tickets BIGINT,
    avg_resolution_hours NUMERIC,
    sla_compliance_rate NUMERIC,
    resolution_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_tickets,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::numeric, 2) as avg_resolution_hours,
        ROUND((COUNT(*) FILTER (WHERE sla_violated = false)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as sla_compliance_rate,
        ROUND((COUNT(*) FILTER (WHERE status = 'closed')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as resolution_rate
    FROM service_tickets
    WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON ticket_stats TO authenticated;
GRANT SELECT ON tickets_by_type TO authenticated;
GRANT SELECT ON tickets_by_priority TO authenticated;
GRANT SELECT ON tickets_by_requester TO authenticated;
GRANT SELECT ON daily_ticket_trend TO authenticated;

-- Grant EXECUTE on function
GRANT EXECUTE ON FUNCTION get_ticket_metrics TO authenticated;

-- Comments
COMMENT ON VIEW ticket_stats IS 'Overall ticket statistics for the last 30 days';
COMMENT ON VIEW tickets_by_type IS 'Ticket distribution and resolution rates by type';
COMMENT ON VIEW tickets_by_priority IS 'Ticket distribution and metrics by priority level';
COMMENT ON VIEW tickets_by_requester IS 'Ticket counts by professor';
COMMENT ON VIEW daily_ticket_trend IS 'Daily ticket creation trend';
COMMENT ON FUNCTION get_ticket_metrics IS 'Get ticket metrics for a custom date range';

-- Verification
SELECT 'Ticket reporting views and functions created successfully' AS message;
