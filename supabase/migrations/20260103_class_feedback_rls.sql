-- Migração para atualizar política RLS da tabela class_feedback
-- Permite que superadmins também possam inserir feedback

-- Remove política existente de INSERT (se existir)
DROP POLICY IF EXISTS "Professors can insert their own feedback" ON class_feedback;
DROP POLICY IF EXISTS "Only class professor can insert feedback" ON class_feedback;
DROP POLICY IF EXISTS "insert_own_feedback" ON class_feedback;
DROP POLICY IF EXISTS "Professors and superadmins can insert feedback" ON class_feedback;

-- Cria nova política que permite professores E superadmins inserirem feedback
CREATE POLICY "Professors and superadmins can insert feedback"
ON class_feedback FOR INSERT
WITH CHECK (
    -- Professor da aula pode inserir
    professor_id = auth.uid()
    OR
    -- Superadmins podem inserir para qualquer professor
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

-- Atualiza política de UPDATE também
DROP POLICY IF EXISTS "Professors can update their own feedback" ON class_feedback;
DROP POLICY IF EXISTS "update_own_feedback" ON class_feedback;
DROP POLICY IF EXISTS "Professors and superadmins can update feedback" ON class_feedback;

CREATE POLICY "Professors and superadmins can update feedback"
ON class_feedback FOR UPDATE
USING (
    professor_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

-- Política de SELECT (visualização)
DROP POLICY IF EXISTS "Users can view feedback for their classes" ON class_feedback;
DROP POLICY IF EXISTS "select_own_feedback" ON class_feedback;
DROP POLICY IF EXISTS "Users can view relevant feedback" ON class_feedback;

CREATE POLICY "Users can view relevant feedback"
ON class_feedback FOR SELECT
USING (
    -- Professor pode ver seus feedbacks
    professor_id = auth.uid()
    OR
    -- Aluno pode ver feedbacks das suas aulas
    student_id = auth.uid()
    OR
    -- Superadmins podem ver tudo
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

-- Política de DELETE
DROP POLICY IF EXISTS "Professors can delete their own feedback" ON class_feedback;
DROP POLICY IF EXISTS "delete_own_feedback" ON class_feedback;
DROP POLICY IF EXISTS "Professors and superadmins can delete feedback" ON class_feedback;

CREATE POLICY "Professors and superadmins can delete feedback"
ON class_feedback FOR DELETE
USING (
    professor_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);
