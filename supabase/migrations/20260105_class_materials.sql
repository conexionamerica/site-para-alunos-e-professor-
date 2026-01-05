-- =====================================================
-- Migração: Materiais de Aula (PDFs)
-- Data: 2026-01-05
-- Descrição: Tabela para armazenar materiais PDF das aulas
-- =====================================================

-- Tabela de materiais de aula
CREATE TABLE IF NOT EXISTS class_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    material_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_class_materials_appointment ON class_materials(appointment_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_student ON class_materials(student_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_professor ON class_materials(professor_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_class_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_class_materials_updated_at ON class_materials;
CREATE TRIGGER trg_class_materials_updated_at
    BEFORE UPDATE ON class_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_class_materials_updated_at();

-- RLS (Row Level Security) para garantir que cada aluno só veja seus materiais
ALTER TABLE class_materials ENABLE ROW LEVEL SECURITY;

-- Política: Alunos só podem ver seus próprios materiais
DROP POLICY IF EXISTS "Students can view own materials" ON class_materials;
CREATE POLICY "Students can view own materials" 
    ON class_materials FOR SELECT
    USING (auth.uid() = student_id);

-- Política: Professores podem ver materiais que criaram
DROP POLICY IF EXISTS "Professors can view own materials" ON class_materials;
CREATE POLICY "Professors can view own materials"
    ON class_materials FOR SELECT
    USING (auth.uid() = professor_id);

-- Política: Professores podem inserir materiais
DROP POLICY IF EXISTS "Professors can insert materials" ON class_materials;
CREATE POLICY "Professors can insert materials"
    ON class_materials FOR INSERT
    WITH CHECK (auth.uid() = professor_id);

-- Política: Professores podem deletar seus próprios materiais
DROP POLICY IF EXISTS "Professors can delete own materials" ON class_materials;
CREATE POLICY "Professors can delete own materials"
    ON class_materials FOR DELETE
    USING (auth.uid() = professor_id);

-- Política: Superadmins podem fazer tudo
DROP POLICY IF EXISTS "Superadmins full access" ON class_materials;
CREATE POLICY "Superadmins full access"
    ON class_materials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );

-- Comentários
COMMENT ON TABLE class_materials IS 'Materiais PDF enviados pelos professores para aulas específicas';
COMMENT ON COLUMN class_materials.appointment_id IS 'Aula à qual o material está associado';
COMMENT ON COLUMN class_materials.student_id IS 'Aluno que pode visualizar o material';
COMMENT ON COLUMN class_materials.professor_id IS 'Professor que enviou o material';
COMMENT ON COLUMN class_materials.material_name IS 'Nome do material dado pelo professor';
COMMENT ON COLUMN class_materials.file_name IS 'Nome original do arquivo PDF';
COMMENT ON COLUMN class_materials.file_url IS 'URL do arquivo no Supabase Storage';
