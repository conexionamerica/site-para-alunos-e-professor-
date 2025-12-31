-- Corrigir warnings de search_path apenas para funções de tickets que existem
-- Versão simplificada focando apenas nas funções criadas hoje

-- Funções do sistema de tickets
ALTER FUNCTION public.generate_ticket_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_ticket_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_ticket_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_expected_response_time() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_sla_violation() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_first_response() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_resolved_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_attachment_size() SET search_path = public, pg_temp;

-- Funções de permissões RLS
ALTER FUNCTION public.is_admin_or_superadmin() SET search_path = public, pg_temp;

-- Observação: outras funções do sistema podem ser corrigidas posteriormente
-- conforme necessário, usando ALTER FUNCTION individualmente
