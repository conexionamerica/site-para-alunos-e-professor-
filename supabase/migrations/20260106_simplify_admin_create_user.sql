-- =====================================================
-- MIGRAÇÃO: Simplificar RPC admin_create_user  
-- Data: 2026-01-06
-- Descrição: Simplifica função para aceitar apenas
--            nome, email, senha e perfil
--            A senha é gravada exatamente como digitada
-- =====================================================

-- Primeiro garantir que pgcrypto esteja habilitado
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    -- Parâmetros opcionais com valores default
    p_username TEXT DEFAULT '',
    p_student_code TEXT DEFAULT NULL,
    p_assigned_professor_id UUID DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_cpf TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_gender TEXT DEFAULT NULL,
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
    existing_user_id UUID;
    hashed_password TEXT;
BEGIN
    -- Validação básica
    IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
        RAISE EXCEPTION 'Email is required';
    END IF;
    
    IF p_password IS NULL OR length(p_password) = 0 THEN
        RAISE EXCEPTION 'Password is required';
    END IF;
    
    IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
        RAISE EXCEPTION 'Full name is required';
    END IF;

    -- Gerar hash da senha usando bcrypt (exatamente como digitada)
    -- A função crypt com gen_salt('bf') usa Blowfish
    hashed_password := crypt(p_password, gen_salt('bf'));

    -- Verificar se já existe perfil com este e-mail
    SELECT id INTO existing_user_id FROM public.profiles WHERE real_email = lower(p_email) LIMIT 1;
    
    IF existing_user_id IS NOT NULL THEN
        RAISE EXCEPTION 'User with this email already exists in profiles';
    END IF;

    -- Tentar buscar usuário existente em auth.users
    SELECT id INTO existing_user_id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
    
    IF existing_user_id IS NOT NULL THEN
        -- Usuário existe em auth mas não em profiles (órfão) - atualizar senha e criar perfil
        new_user_id := existing_user_id;
        
        -- Atualizar a senha para o novo valor
        UPDATE auth.users 
        SET encrypted_password = hashed_password,
            updated_at = NOW(),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = existing_user_id;
    ELSE
        -- Criar novo usuário em auth.users
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
            lower(p_email),
            hashed_password,
            NOW(), -- Email já confirmado
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
    END IF;

    -- Criar perfil na tabela profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        username,
        real_email,
        phone,
        role,
        student_code,
        assigned_professor_id,
        cpf,
        birth_date,
        gender,
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
        COALESCE(NULLIF(p_username, ''), lower(p_email)), -- usa email como username se não informado
        lower(p_email),
        p_phone,
        p_role,
        p_student_code,
        p_assigned_professor_id,
        p_cpf,
        p_birth_date,
        p_gender,
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
        RAISE EXCEPTION 'User with this email, CPF, or student code already exists';
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- =====================================================
-- Comentários
-- =====================================================

COMMENT ON FUNCTION admin_create_user IS 'Cria novo usuário com dados mínimos (nome, email, senha, perfil). 
A senha é salva exatamente como digitada, respeitando maiúsculas, minúsculas e símbolos especiais.
Parâmetros adicionais são opcionais.';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
