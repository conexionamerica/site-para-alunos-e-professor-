-- Corrigir warnings de search_path em funções críticas
-- Adiciona SET search_path = public, pg_temp para prevenir ataques de search path hijacking

-- Funções do sistema de tickets (prioritárias - criadas hoje)
ALTER FUNCTION public.generate_ticket_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_ticket_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_ticket_timestamp() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_expected_response_time() SET search_path = public, pg_temp;
ALTER FUNCTION public.check_sla_violation() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_first_response() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_resolved_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_attachment_size() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_ticket_metrics() SET search_path = public, pg_temp;

-- Funções de autenticação e permissões
ALTER FUNCTION public.is_admin_or_superadmin() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_superadmin() SET search_path = public, pg_temp;

-- Funções de gestão de usuários
ALTER FUNCTION public.admin_create_user(text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_link_professor(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_status(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_user_complete(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- Funções de perfil e códigos
ALTER FUNCTION public.generate_student_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_student_code_on_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

-- Funções de aulas e solicitações
ALTER FUNCTION public.approve_class_request(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_class_request(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_solicitud_update() SET search_path = public, pg_temp;

-- Funções de chat
ALTER FUNCTION public.get_professor_chat_list(uuid) SET search_path = public, pg_temp;
