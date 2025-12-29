-- Função RPC para excluir um usuário por completo (Auth + Profile)
-- Deve ser executada pelo EDITOR SQL do Supabase
-- Somente Superadmins podem chamar esta função

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_calling_user_role TEXT;
BEGIN
    -- 1. Verificar se quem está chamando é Superadmin
    SELECT role INTO v_calling_user_role 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF v_calling_user_role != 'superadmin' THEN
        RAISE EXCEPTION 'Apenas administradores podem excluir usuários.';
    END IF;

    -- 2. Excluir perfil público (dispara cascata se houver FKs com CASCADE)
    -- Se houver restrições de FK, o erro será lançado aqui
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 3. Excluir do Auth (requer SECURITY DEFINER para acessar auth.users)
    DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

COMMENT ON FUNCTION delete_user_complete IS 'Exclui permanentemente um usuário das tabelas auth.users e public.profiles. Requer cargo superadmin.';
