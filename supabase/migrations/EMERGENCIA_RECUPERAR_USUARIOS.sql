-- ⚠️ SCRIPT DE EMERGENCIA - EJECUTAR INMEDIATAMENTE ⚠️
-- Este script arregla el problema de usuarios registrados que no aparecen

-- PASO 1: Crear/Actualizar el trigger para nuevos registros
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
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'real_email', NEW.email),
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    real_email = EXCLUDED.real_email;
  RETURN NEW;
END;
$$;

-- PASO 2: Asegurarse de que el trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PASO 3: Agregar columna real_email si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS real_email TEXT;

-- PASO 4: Crear índice si no existe
CREATE INDEX IF NOT EXISTS idx_profiles_real_email ON profiles(real_email);

-- PASO 5: RECUPERAR USUARIOS PERDIDOS
-- Esto crea perfiles para usuarios que se registraron pero no tienen perfil
INSERT INTO public.profiles (id, email, username, full_name, role, real_email, is_active)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', ''),
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuario Sin Nombre'),
  COALESCE(u.raw_user_meta_data->>'role', 'student'),
  COALESCE(u.raw_user_meta_data->>'real_email', u.email),
  true
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- PASO 6: Actualizar real_email para usuarios existentes que no lo tienen
UPDATE profiles 
SET real_email = email 
WHERE real_email IS NULL;

-- PASO 7: Verificar que todo funcionó
SELECT 
  'Total usuarios en auth.users' as descripcion,
  COUNT(*) as cantidad
FROM auth.users
UNION ALL
SELECT 
  'Total perfiles en profiles' as descripcion,
  COUNT(*) as cantidad
FROM profiles
UNION ALL
SELECT 
  'Usuarios sin perfil (debería ser 0)' as descripcion,
  COUNT(*) as cantidad
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
