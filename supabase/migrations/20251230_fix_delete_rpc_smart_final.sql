-- =====================================================
-- CORREÇÃO FINAL E INTELIGENTE: Exclusão de Usuário
-- Lida com a inconsistência de nomes (professor_id vs profesor_id)
-- =====================================================

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calling_user_role TEXT;
    v_target_user_active BOOLEAN;
BEGIN
    -- 1. Verificar permissão de admin
    SELECT role INTO v_calling_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- 2. Verificar se o usuário está inativo (Trava de Segurança)
    SELECT is_active INTO v_target_user_active FROM public.profiles WHERE id = p_user_id;
    IF v_target_user_active IS NOT FALSE THEN
        RAISE EXCEPTION 'Não é permitido excluir um usuário ativo. Inative-o antes.';
    END IF;

    -- 3. LIMPEZA INTELIGENTE
    
    -- Mensagens e Chats
    DELETE FROM public.mensajes WHERE remitente_id = p_user_id;
    
    -- Tenta deletar chats lidando com possíveis nomes de colunas (profesor/professor)
    BEGIN
        DELETE FROM public.chats WHERE profesor_id = p_user_id OR alumno_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.chats WHERE professor_id = p_user_id OR student_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Student Messages (Avisos)
    BEGIN
        DELETE FROM public.student_messages WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.student_messages WHERE alumno_id = p_user_id OR profesor_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Notificações
    DELETE FROM public.notifications WHERE user_id = p_user_id;

    -- Appointments (Aulas)
    BEGIN
        DELETE FROM public.appointments WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.appointments WHERE student_id = p_user_id OR profesor_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Solicitações (Solicitudes)
    BEGIN
        DELETE FROM public.solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.solicitudes_clase WHERE student_id = p_user_id OR professor_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Histórico de Pacotes (assigned_packages_log)
    BEGIN
        DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR profesor_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Faturamento (billing)
    DELETE FROM public.billing WHERE user_id = p_user_id;

    -- Slots de Horários
    BEGIN
        DELETE FROM public.class_slots WHERE professor_id = p_user_id;
    EXCEPTION WHEN OTHERS THEN 
        BEGIN
            DELETE FROM public.class_slots WHERE profesor_id = p_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;

    -- Por fim, deleta o perfil público e a conta de sistema (Auth)
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;
