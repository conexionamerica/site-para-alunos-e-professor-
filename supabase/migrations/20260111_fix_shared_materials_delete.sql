-- Migración para permitir a los administradores eliminar materiales compartidos
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar la política existente de admin si existe (para evitar conflicto)
DROP POLICY IF EXISTS "Admins can manage all materials" ON shared_materials;

-- 2. Crear política amplia para administradores (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all materials"
  ON shared_materials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- 3. Permitir también a profesores eliminar materiales que ellos crearon
DROP POLICY IF EXISTS "Professors can delete own materials" ON shared_materials;

CREATE POLICY "Professors can delete own materials"
  ON shared_materials
  FOR DELETE
  USING (
    auth.uid() = professor_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- 4. Verificar que el storage bucket existe y tiene políticas correctas
-- Si no existe, crear el bucket 'shared-materials'
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-materials', 'shared-materials', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Políticas de storage para eliminar archivos
DROP POLICY IF EXISTS "Admins and professors can delete shared materials" ON storage.objects;

CREATE POLICY "Admins and professors can delete shared materials"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'shared-materials'
    AND (
      -- Profesor dueño del archivo
      (storage.foldername(name))[1] = 'professor-materials'
      AND (storage.foldername(name))[2] = auth.uid()::text
      OR
      -- Admin puede eliminar cualquier archivo
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'professor')
      )
    )
  );
