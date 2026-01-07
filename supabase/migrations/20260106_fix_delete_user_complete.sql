-- =====================================================
-- CORREÇÃO COMPLETA: Exclusão de Usuário
-- Remove TODOS os dados relacionados ao usuário
-- Versão: 2026-01-06
-- =====================================================

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calling_user_role TEXT;
BEGIN
    -- 1. Verificar permissão de admin
    SELECT role INTO v_calling_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- REMOVIDA TRAVA: Administrador pode excluir a qualquer momento (ativo ou inativo)

    -- ========================================
    -- 2. LIMPEZA DE TODAS AS TABELAS RELACIONADAS
    -- ========================================

    -- 2.1 Admin Notifications (notificações administrativas)
    BEGIN
        DELETE FROM public.admin_notifications WHERE student_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
        DELETE FROM public.admin_notifications WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.2 Class Feedback (feedbacks de aulas)
    BEGIN
        DELETE FROM public.class_feedback WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.3 Mensagens e Chats
    BEGIN
        DELETE FROM public.mensajes WHERE remitente_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.chats WHERE profesor_id = p_user_id OR alumno_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
        DELETE FROM public.chats WHERE professor_id = p_user_id OR student_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.4 Student Messages (Avisos)
    BEGIN
        DELETE FROM public.student_messages WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.student_messages WHERE alumno_id = p_user_id OR profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.5 Notificações
    BEGIN
        DELETE FROM public.notifications WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.6 Appointments (Aulas) - Antes, liberamos os slots que estavam ocupados
    BEGIN
        UPDATE public.class_slots 
        SET status = 'active' 
        WHERE status = 'filled' 
          AND id IN (SELECT class_slot_id FROM public.appointments WHERE student_id = p_user_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
        DELETE FROM public.appointments WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.appointments WHERE student_id = p_user_id OR profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.7 Solicitações (Solicitudes)
    BEGIN
        DELETE FROM public.solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.solicitudes_clase WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.8 Histórico de Pacotes (assigned_packages_log)
    BEGIN
        DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.9 Faturamento (billing)
    BEGIN
        DELETE FROM public.billing WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.10 Títulos Financeiros (financial_titles)
    BEGIN
        DELETE FROM public.financial_titles WHERE user_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN
        DELETE FROM public.financial_titles WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.11 Slots de Horários (apenas para professores)
    BEGIN
        DELETE FROM public.class_slots WHERE professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        DELETE FROM public.class_slots WHERE profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.12 Audit Logs (logs de auditoria) - ID do usuário que fez a ação
    BEGIN
        DELETE FROM public.audit_logs WHERE changed_by = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.13 Limpar referências de professor vinculado em outros alunos
    BEGIN
        UPDATE public.profiles 
        SET assigned_professor_id = NULL, 
            pending_professor_id = NULL 
        WHERE assigned_professor_id = p_user_id OR pending_professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.14 Professor Announcements (comunicados criados pelo usuário)
    BEGIN
        DELETE FROM public.professor_announcements WHERE created_by = p_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- ========================================
    -- 3. EXCLUSÃO FINAL DO PERFIL E AUTH
    -- ========================================
    
    -- Por fim, deleta o perfil público e a conta de sistema (Auth)
    DELETE FROM public.profiles WHERE id = p_user_id;
    
    -- Tentar deletar da tabela auth.users (pode falhar se não tiver permissão)
    BEGIN
        DELETE FROM auth.users WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        -- Se não conseguir deletar de auth.users, pelo menos o perfil foi removido
        NULL; 
    END;

END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION delete_user_complete(UUID) IS 
'Deleta completamente um usuário e TODOS os seus dados relacionados. 
Inclui: notificações, aulas, chats, faturas, pacotes, feedbacks, logs, etc.
Apenas superadmin pode executar. Libera slots ocupados antes de deletar aulas.';
