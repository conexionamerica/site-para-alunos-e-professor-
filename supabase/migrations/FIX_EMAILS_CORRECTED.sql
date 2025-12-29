-- 🚨 SCRIPT DE CORREÇÃO (SEM A COLUNA EMAIL) 🚨
-- Execute este script para corrigir o problema. Removida a referência à coluna 'email' que não existe.

-- 1. Preencher a coluna 'real_email' com o e-mail do login para TODOS os usuários
UPDATE public.profiles p
SET real_email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 2. Atualizar a função automática para NOVOS usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role, real_email, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'real_email', NEW.email),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    real_email = EXCLUDED.real_email,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

-- 3. Reaplicar o gatilho
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
