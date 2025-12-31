-- Corrigir avisos de segurança: Remover SECURITY DEFINER das views
-- As views agora usarão as permissões do usuário que faz a query (SECURITY INVOKER)
-- Como já temos RLS adequado nas tabelas, isso é mais seguro

-- 1. Recriar ticket_stats com SECURITY INVOKER explícito
DROP VIEW IF EXISTS public.ticket_stats CASCADE;
CREATE VIEW public.ticket_stats 
WITH (security_invoker=true) AS
SELECT
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'open') as open_count,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
    AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) FILTER (WHERE first_response_at IS NOT NULL) as avg_first_response_hours,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_this_week
FROM service_tickets;

-- 2. Recriar tickets_by_type com SECURITY INVOKER explícito
DROP VIEW IF EXISTS public.tickets_by_type CASCADE;
CREATE VIEW public.tickets_by_type 
WITH (security_invoker=true) AS
SELECT
    type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'closed') as resolved_count
FROM service_tickets
GROUP BY type;

-- 3. Recriar tickets_by_priority com SECURITY INVOKER explícito
DROP VIEW IF EXISTS public.tickets_by_priority CASCADE;
CREATE VIEW public.tickets_by_priority 
WITH (security_invoker=true) AS
SELECT
    priority,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status != 'closed') as open_count
FROM service_tickets
GROUP BY priority;

-- 4. Recriar tickets_by_requester com SECURITY INVOKER explícito
DROP VIEW IF EXISTS public.tickets_by_requester CASCADE;
CREATE VIEW public.tickets_by_requester 
WITH (security_invoker=true) AS
SELECT
    requester_id,
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_tickets,
    COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets
FROM service_tickets
GROUP BY requester_id;

-- 5. Recriar daily_ticket_trend com SECURITY INVOKER explícito
DROP VIEW IF EXISTS public.daily_ticket_trend CASCADE;
CREATE VIEW public.daily_ticket_trend 
WITH (security_invoker=true) AS
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
