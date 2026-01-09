-- Crear tabla de materiales compartidos por el profesor
CREATE TABLE IF NOT EXISTS shared_materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  professor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = compartido con todos los alumnos del profesor
  material_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('PDF', 'MP3', 'MP4', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'ZIP', 'OTHER')),
  file_size_bytes BIGINT,
  category TEXT, -- Gramática, Vocabulário, Listening, Exercícios, etc.
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_shared_materials_professor_id ON shared_materials(professor_id);
CREATE INDEX IF NOT EXISTS idx_shared_materials_student_id ON shared_materials(student_id);
CREATE INDEX IF NOT EXISTS idx_shared_materials_created_at ON shared_materials(created_at DESC);

-- RLS Policies
ALTER TABLE shared_materials ENABLE ROW LEVEL SECURITY;

-- Los profesores pueden ver sus propios materiales
CREATE POLICY "Professors can view own materials"
  ON shared_materials
  FOR SELECT
  USING (
    auth.uid() = professor_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Los alumnos pueden ver materiales compartidos con ellos
CREATE POLICY "Students can view shared materials"
  ON shared_materials
  FOR SELECT
  USING (
    -- Materiales compartidos específicamente con el alumno
    auth.uid() = student_id
    OR
    -- Materiales compartidos con todos los alumnos del profesor
    (
      student_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.assigned_professor_id = shared_materials.professor_id
      )
    )
  );

-- Los profesores pueden crear materiales
CREATE POLICY "Professors can create materials"
  ON shared_materials
  FOR INSERT
  WITH CHECK (
    auth.uid() = professor_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'professor'
    )
  );

-- Los profesores pueden actualizar sus propios materiales
CREATE POLICY "Professors can update own materials"
  ON shared_materials
  FOR UPDATE
  USING (auth.uid() = professor_id)
  WITH CHECK (auth.uid() = professor_id);

-- Los profesores pueden eliminar sus propios materiales
CREATE POLICY "Professors can delete own materials"
  ON shared_materials
  FOR DELETE
  USING (auth.uid() = professor_id);

-- Los administradores pueden hacer todo
CREATE POLICY "Admins can manage all materials"
  ON shared_materials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_shared_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shared_materials_updated_at
  BEFORE UPDATE ON shared_materials
  FOR EACH ROW
  EXECUTE FUNCTION update_shared_materials_updated_at();
