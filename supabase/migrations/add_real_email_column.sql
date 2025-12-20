-- Agregar columna real_email a la tabla profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS real_email TEXT;

-- Crear índice para búsquedas más rápidas por real_email
CREATE INDEX IF NOT EXISTS idx_profiles_real_email ON profiles(real_email);

-- Actualizar el trigger para incluir real_email al crear un perfil
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
  );
  RETURN NEW;
END;
$$;

-- Asegurarse de que el trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Actualizar registros existentes que no tienen real_email
UPDATE profiles 
SET real_email = email 
WHERE real_email IS NULL;
