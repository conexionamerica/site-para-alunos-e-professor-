-- =====================================================
-- MIGRACIÓN: Mejorar RLS para Profiles y Actualizar RPC de Exclusión
-- Permite que Superadmins inativem usuários e excluam com trava de segurança
-- =====================================================

-- 1. Asegurar que Superadmins puedan actualizar el campo is_active y otros campos de perfiles
DROP POLICY IF EXISTS "Superadmins can update any profile" ON public.profiles;
CREATE POLICY "Superadmins can update any profile" 
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'superadmin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'superadmin'
    )
);

-- 2. Actualizar RPC delete_user_complete para incluir la trava de inactividad
-- y limpiar el histórico de paquetes y otras dependencias
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
    -- A. Verificar si el que llama es Superadmin
    SELECT role INTO v_calling_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- B. Verificar si el usuario a excluir existe y su estado
    SELECT is_active, full_name INTO v_target_user_active, v_target_user_name
    FROM public.profiles 
    WHERE id = p_user_id;

    IF v_target_user_name IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado.';
    END IF;

    -- C. TRAVA DE SEGURANÇA: Solo permitir excluir si está INATIVO
    -- Se considera inativo se is_active es false. Si es NULL se asume Ativo por defecto en la lógica.
    IF v_target_user_active IS NOT FALSE THEN
        RAISE EXCEPTION 'Não é permitido excluir um usuário ativo. Por favor, inative o usuário antes de excluí-lo.';
    END IF;

    -- D. LIMPEZA DE DEPENDÊNCIAS (Ordem para evitar violação de FK)
    
    -- 1. Mensagens
    DELETE FROM public.mensagens WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    
    -- 2. Notificações
    DELETE FROM public.notifications WHERE user_id = p_user_id;

    -- 3. Histórico de Pendências (referencia_id pode ser o aluno)
    DELETE FROM public.pendencias_historico WHERE referencia_id = p_user_id OR ignorado_por = p_user_id;

    -- 4. Aulas (Appointments)
    -- Se for aluno, deleta suas aulas. Se for professor, o sistema provavelmente exige vincular as aulas a outro ou deletá-las.
    DELETE FROM public.appointments WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- 5. Solicitações de Aula
    DELETE FROM public.solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

    -- 6. Histórico de Pacotes (assigned_packages_log)
    DELETE FROM public.assigned_packages_log WHERE student_id = p_user_id OR professor_id = p_user_id;

    -- 7. Faturamento (billing)
    DELETE FROM public.billing WHERE student_id = p_user_id;

    -- 8. Slots de Aula (se for professor)
    DELETE FROM public.class_slots WHERE professor_id = p_user_id;

    -- 9. Perfil Público
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 10. Usuário do Auth (Sistema)
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

COMMENT ON FUNCTION delete_user_complete IS 'Exclui permanentemente um usuário (Auth+Profile) e todas as suas dependências. EXIGE que o usuário esteja INATIVO.';
