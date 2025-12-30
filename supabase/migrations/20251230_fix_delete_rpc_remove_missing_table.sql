-- =====================================================
-- CORREÇÃO DEFINITIVA: Exclusão de Usuário Sem Erros de Tabela
-- Removendo pendencias_historico que não existe como tabela física
-- =====================================================

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calling_user_role TEXT;
    v_target_user_active BOOLEAN;
    v_target_user_name TEXT;
BEGIN
    -- 1. Verificar permissão de admin
    SELECT role INTO v_calling_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- 2. Verificar se o usuário está inativo (Trava de Segurança)
    SELECT is_active, full_name INTO v_target_user_active, v_target_user_name FROM public.profiles WHERE id = p_user_id;

    -- Se o usuário não existir, encerrar sem erro
    IF v_target_user_name IS NULL THEN 
        RETURN;
    END IF;

    -- Trava para evitar exclusão de ativos
    IF v_target_user_active IS NOT FALSE THEN
        RAISE EXCEPTION 'Não é permitido excluir um usuário ativo. Por favor, inative-o antes.';
    END IF;

    -- LIMPEZA COMPLETA DE DEPENDÊNCIAS
    
    -- Deleta mensagens e chats
    DELETE FROM public.mensajes 
    WHERE remitente_id = p_user_id 
       OR chat_id IN (SELECT chat_id FROM public.chats WHERE profesor_id = p_user_id OR alumno_id = p_user_id);
    
    DELETE FROM public.chats 
    WHERE profesor_id = p_user_id OR alumno_id = p_user_id;

    -- Deleta avisos individuais aos alunos
    DELETE FROM public.student_messages 
    WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- Deleta notificações
    DELETE FROM public.notifications 
    WHERE user_id = p_user_id;

    -- Deleta aulas agendadas e solicitações
    DELETE FROM public.appointments 
    WHERE student_id = p_user_id OR professor_id = p_user_id;

    DELETE FROM public.solicitudes_clase 
    WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

    -- Deleta histórico de pacotes e faturamento
    DELETE FROM public.assigned_packages_log 
    WHERE student_id = p_user_id OR professor_id = p_user_id;

    DELETE FROM public.billing 
    WHERE student_id = p_user_id;

    -- Deleta horários de professores
    DELETE FROM public.class_slots 
    WHERE professor_id = p_user_id;

    -- Por fim, deleta o perfil público e a conta de sistema (Auth)
    DELETE FROM public.profiles 
    WHERE id = p_user_id;

    DELETE FROM auth.users 
    WHERE id = p_user_id;

END;
$$;

COMMENT ON FUNCTION delete_user_complete IS 'Exclui permanentemente um usuário e todos os seus dados em todas as tabelas funcionais.';
