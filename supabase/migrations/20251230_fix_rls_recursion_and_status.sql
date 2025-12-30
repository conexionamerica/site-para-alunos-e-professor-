-- =====================================================
-- CORRECCIÓN CRÍTICA: RLS Recursion Fix y Status Update
-- Fecha: 2025-12-30
-- =====================================================

-- 1. Crear una función para verificar si el usuario es superadmin sin causar recursión
-- SECURITY DEFINER corre con privilegios de sistema, saltando el chequeo RLS de la tabla
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corregir las políticas de la tabla profiles para usar la función is_superadmin()
-- Esto evita que la política se llame a sí misma (recursión infinita)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Superadmins can read all profiles" ON public.profiles;

-- Política de Lectura
CREATE POLICY "Superadmins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_superadmin()
  OR auth.uid() = id
);

-- Política de Actualización
CREATE POLICY "Superadmins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

-- 3. Crear un RPC específico para actualizar el status de un usuario
-- Esto garantiza que el cambio de status funcione incluso si hay problemas de RLS complejos
CREATE OR REPLACE FUNCTION update_user_status(p_user_id UUID, p_is_active BOOLEAN)
RETURNS void AS $$
BEGIN
  -- Verificar si quien llama es superadmin
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o status de usuários.';
  END IF;

  UPDATE public.profiles
  SET is_active = p_is_active
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_user_status IS 'Altera o status de atividade de um usuário. Exclusivo para superadmins.';
