-- =====================================================
-- CORREÇÃO FINAL: Exclusão Completa e Segura de Usuários
-- Corrigindo nomes de tabelas (mensagens -> mensajes) e dependências
-- =====================================================

-- 1. Garantir que a função is_superadmin() existe para evitar recursão no RLS
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar RPC delete_user_complete com nomes de tabelas corrigidos
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
    -- A. Verificar quem está chamando
    SELECT role INTO v_calling_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- B. Verificar estado do alvo
    SELECT is_active, full_name INTO v_target_user_active, v_target_user_name FROM public.profiles WHERE id = p_user_id;
    IF v_target_user_name IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado.'; END IF;

    -- C. Trava de inatividade
    IF v_target_user_active IS NOT FALSE THEN
        RAISE EXCEPTION 'Não é permitido excluir um usuário ativo. Inative-o antes.';
    END IF;

    -- D. LIMPEZA COMPLETA (Nomes de tabelas validados)
    
    -- 1. Mensagens de Chat (mensajes) e Chats
    -- Primeiro as mensagens vinculadas aos chats do usuário ou enviadas por ele
    DELETE FROM public.mensajes 
    WHERE remitente_id = p_user_id 
       OR chat_id IN (SELECT chat_id FROM public.chats WHERE profesor_id = p_user_id OR alumno_id = p_user_id);
    
    DELETE FROM public.chats WHERE profesor_id = p_user_id OR alumno_id = p_user_id;

    -- 2. Recados/Avisos para Alunos (student_messages)
    DELETE FROM public.student_messages WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- 3. Notificações
    DELETE FROM public.notifications WHERE user_id = p_user_id;

    -- 4. Histórico de Pendências
    DELETE FROM public.pendencias_historico WHERE referencia_id = p_user_id OR ignorado_por = p_user_id;

    -- 5. Aulas (Appointments)
    DELETE FROM public.appointments WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- 6. Solicitações de Aula
    DELETE FROM public.solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

    -- 7. Histórico de Pacotes
    DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- 8. Faturamento (billing)
    DELETE FROM public.billing WHERE student_id = p_user_id;

    -- 9. Slots de Aula (Professores)
    DELETE FROM public.class_slots WHERE professor_id = p_user_id;

    -- 10. Perfil e Auth
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

COMMENT ON FUNCTION delete_user_complete IS 'Exclui permanentemente um usuário e todos os dados em todas as tabelas (mensajes, chats, billing, etc).';
