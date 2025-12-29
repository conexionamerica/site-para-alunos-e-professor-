-- 🚨 SCRIPT DE CORREÇÃO DEFINITIVA DE E-MAILS 🚨
-- Execute este script no Editor SQL do Supabase para corrigir os e-mails nulos e garantir os futuros.

-- 1. Forçar a cópia do e-mail de login (auth.users) para o perfil (profiles) para TODOS os usuários
UPDATE public.profiles p
SET 
  real_email = u.email,
  email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 2. Atualizar a função que cria novos usuários para garantir que o e-mail seja salvo corretamente desde o início
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role, real_email, is_active)
  VALUES (
    NEW.id,
    NEW.email, -- Salva na coluna de compatibilidade
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'real_email', NEW.email), -- Salva na coluna real_email
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    real_email = EXCLUDED.real_email,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- 3. Recriar o gatilho (trigger) para garantir que ele use a nova função atualizada
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Confirmação
SELECT count(*) as total_usuarios_corrigidos FROM profiles WHERE real_email IS NOT NULL;
