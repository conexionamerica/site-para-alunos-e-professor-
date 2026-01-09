-- ============================================================
-- POLÍTICAS DE SEGURIDAD PARA EL BUCKET DE AVATARS
-- ============================================================
-- Ejecutar este script en Supabase SQL Editor para habilitar
-- la subida de fotos de perfil
-- ============================================================

-- 1. Primero, verificar si el bucket existe. Si no, créalo manualmente:
-- Dashboard -> Storage -> New Bucket -> Name: "avatars" -> Public: YES

-- 2. Eliminar políticas existentes que puedan estar causando conflicto
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their avatars" ON storage.objects;

-- 3. Crear política para permitir a usuarios autenticados SUBIR archivos al bucket avatars
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 4. Crear política para permitir acceso PÚBLICO de lectura a los avatars
CREATE POLICY "Allow public access to avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 5. Crear política para permitir a usuarios autenticados ACTUALIZAR sus avatars
CREATE POLICY "Allow users to update their avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 6. Crear política para permitir a usuarios autenticados ELIMINAR sus avatars
CREATE POLICY "Allow users to delete their avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- ============================================================
-- ALTERNATIVA: Si el bucket no existe, créalo con SQL
-- ============================================================
-- Nota: Esto puede requerir permisos especiales
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('avatars', 'avatars', true)
-- ON CONFLICT (id) DO NOTHING;

SELECT 'Políticas de storage para avatars creadas con éxito!' as resultado;
