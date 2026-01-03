-- =====================================================
-- MIGRAÇÃO: Atualizar RPC admin_create_user
-- Data: 2026-01-03
-- Descrição: Atualiza função admin_create_user para
--            suportar campos de dados pessoais
-- =====================================================

CREATE OR REPLACE FUNCTION admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_username TEXT DEFAULT '',
    p_student_code TEXT DEFAULT NULL,
    p_assigned_professor_id UUID DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_address_street TEXT DEFAULT NULL,
    p_address_number TEXT DEFAULT NULL,
    p_address_complement TEXT DEFAULT NULL,
    p_address_neighborhood TEXT DEFAULT NULL,
    p_address_city TEXT DEFAULT NULL,
    p_address_state TEXT DEFAULT NULL,
    p_address_zip_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_user_id UUID;
    new_profile_id UUID;
BEGIN
    -- 1. Criar usuário Auth
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        recovery_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) VALUES (
       '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        p_email,
        crypt(p_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    ) RETURNING id INTO new_user_id;

    -- 2. Criar perfil
    INSERT INTO public.profiles (
        id,
        full_name,
        username,
        email,
        real_email,
        phone,
        role,
        student_code,
        assigned_professor_id,
        cpf,
        birth_date,
        address_street,
        address_number,
        address_complement,
        address_neighborhood,
        address_city,
        address_state,
        address_zip_code,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        p_full_name,
        COALESCE(NULLIF(p_username, ''), p_email),
        p_email,
        p_email,
        p_phone,
        p_role,
        p_student_code,
        p_assigned_professor_id,
        p_cpf,
        p_birth_date,
        p_address_street,
        p_address_number,
        p_address_complement,
        p_address_neighborhood,
        p_address_city,
        p_address_state,
        p_address_zip_code,
        TRUE,
        NOW(),
        NOW()
    ) RETURNING id INTO new_profile_id;

    RETURN new_profile_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Capturar erro de duplicata e fornecer mensagem mais clara
        RAISE EXCEPTION 'User with this email, CPF, or student code already exists';
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- =====================================================
-- Comentários
-- =====================================================

COMMENT ON FUNCTION admin_create_user IS 'Cria novo usuário com dados pessoais completos ou pré-cadastro mínimo';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
