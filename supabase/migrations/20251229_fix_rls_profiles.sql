
-- Garantizar que superadmins puedan actualizar perfiles de otros
DROP POLICY IF EXISTS "Superadmins can update any profile" ON public.profiles;
CREATE POLICY "Superadmins can update any profile" 
ON public.profiles
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- Garantizar que se pueda leer también
DROP POLICY IF EXISTS "Superadmins can read all profiles" ON public.profiles;
CREATE POLICY "Superadmins can read all profiles"
ON public.profiles
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  OR auth.uid() = id
);
