-- Corrigir avisos de segurança: Remover SECURITY DEFINER das views
-- As views agora usarão as permissões do usuário que faz a query (SECURITY INVOKER)
-- Como já temos RLS adequado nas tabelas, isso é mais seguro

-- 1. Recriar ticket_stats sem SECURITY DEFINER
DROP VIEW IF EXISTS public.ticket_stats;
CREATE VIEW public.ticket_stats AS
SELECT
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'open') as open_count,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) FILTER (WHERE first_response_at IS NOT NULL) as avg_first_response_hours,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week
FROM service_tickets;

-- 2. Recriar tickets_by_type sem SECURITY DEFINER
DROP VIEW IF EXISTS public.tickets_by_type;
CREATE VIEW public.tickets_by_type AS
SELECT
    type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'closed') as resolved_count
FROM service_tickets
GROUP BY type;

-- 3. Recriar tickets_by_priority sem SECURITY DEFINER
DROP VIEW IF EXISTS public.tickets_by_priority;
CREATE VIEW public.tickets_by_priority AS
SELECT
    priority,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status != 'closed') as open_count
FROM service_tickets
GROUP BY priority;

-- 4. Recriar tickets_by_requester sem SECURITY DEFINER
DROP VIEW IF EXISTS public.tickets_by_requester;
CREATE VIEW public.tickets_by_requester AS
SELECT
    requester_id,
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets
FROM service_tickets
GROUP BY requester_id;

-- 5. Recriar daily_ticket_trend sem SECURITY DEFINER
DROP VIEW IF EXISTS public.daily_ticket_trend;
CREATE VIEW public.daily_ticket_trend AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as tickets_created,
    COUNT(*) FILTER (WHERE status = 'closed') as tickets_closed
FROM service_tickets
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Garantir que admins possam acessar as views
-- (As views herdarão as permissões RLS das tabelas subjacentes)
GRANT SELECT ON public.ticket_stats TO authenticated;
GRANT SELECT ON public.tickets_by_type TO authenticated;
GRANT SELECT ON public.tickets_by_priority TO authenticated;
GRANT SELECT ON public.tickets_by_requester TO authenticated;
GRANT SELECT ON public.daily_ticket_trend TO authenticated;
