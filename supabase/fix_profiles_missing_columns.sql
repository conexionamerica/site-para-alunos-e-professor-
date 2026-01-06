-- CORREÇÃO ABRANGENTE: Adicionar TODAS as colunas que podem estar faltando em 'profiles'
-- Isso previne erros futuros de "Column not found" ao salvar usuários no painel administrativo.

DO $$
BEGIN
    -- Informações de Responsável
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'responsible_name') THEN
        ALTER TABLE public.profiles ADD COLUMN responsible_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'responsible_phone') THEN
        ALTER TABLE public.profiles ADD COLUMN responsible_phone TEXT;
    END IF;

    -- Informações Acadêmicas e Pessoais Adicionais
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'academic_level') THEN
        ALTER TABLE public.profiles ADD COLUMN academic_level TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'spanish_level') THEN
        ALTER TABLE public.profiles ADD COLUMN spanish_level TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'learning_goals') THEN
        ALTER TABLE public.profiles ADD COLUMN learning_goals TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'observations') THEN
        ALTER TABLE public.profiles ADD COLUMN observations TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cpf') THEN
        ALTER TABLE public.profiles ADD COLUMN cpf TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'birth_date') THEN
        ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'gender') THEN
        ALTER TABLE public.profiles ADD COLUMN gender TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'student_code') THEN
        ALTER TABLE public.profiles ADD COLUMN student_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'registration_status') THEN
        ALTER TABLE public.profiles ADD COLUMN registration_status TEXT DEFAULT 'pre_registered';
    END IF;

    -- Endereço
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_street') THEN
        ALTER TABLE public.profiles ADD COLUMN address_street TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_number') THEN
        ALTER TABLE public.profiles ADD COLUMN address_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_complement') THEN
        ALTER TABLE public.profiles ADD COLUMN address_complement TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_neighborhood') THEN
        ALTER TABLE public.profiles ADD COLUMN address_neighborhood TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_city') THEN
        ALTER TABLE public.profiles ADD COLUMN address_city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_state') THEN
        ALTER TABLE public.profiles ADD COLUMN address_state TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address_zip_code') THEN
        ALTER TABLE public.profiles ADD COLUMN address_zip_code TEXT;
    END IF;

    -- Garantir email (redundância positiva)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;

END $$;
