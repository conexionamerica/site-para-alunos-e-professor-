-- INSTRUCCIONES: Ejecutar este SQL en tu panel de Supabase (SQL Editor)
-- Este script agrega una política RLS que permite a los profesores actualizar registros en assigned_packages_log

-- 1. Primero, verificar si la política ya existe y eliminarla si es necesario
DROP POLICY IF EXISTS "Professors can update assigned_packages_log" ON public.assigned_packages_log;

-- 2. Crear la política que permite a los profesores (usuarios con role='professor') 
--    actualizar registros donde ellos son el professor_id
CREATE POLICY "Professors can update assigned_packages_log" 
ON public.assigned_packages_log 
FOR UPDATE 
USING (
  auth.uid() = professor_id
)
WITH CHECK (
  auth.uid() = professor_id
);

-- 3. Alternativamente, si quieres una política más permisiva (para desarrollo):
-- DROP POLICY IF EXISTS "Allow all updates on assigned_packages_log" ON public.assigned_packages_log;
-- CREATE POLICY "Allow all updates on assigned_packages_log"
-- ON public.assigned_packages_log
-- FOR UPDATE
-- USING (true)
-- WITH CHECK (true);

-- NOTA: Asegúrate de que RLS esté habilitado en la tabla:
-- ALTER TABLE public.assigned_packages_log ENABLE ROW LEVEL SECURITY;
