-- CORREÇÃO: Adicionar coluna 'email' na tabela profiles
-- O erro "Could not find the email column of profiles" ocorre porque o frontend tenta atualizar esse campo, mas ele não existe na tabela pública.

DO $$
BEGIN
    -- 1. Adicionar coluna se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 2. Sincronizar emails da tabela de autenticação (auth.users) para profiles
-- Isso conserta usuários antigos que ficarão com email NULL
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND (p.email IS NULL OR p.email = '');
