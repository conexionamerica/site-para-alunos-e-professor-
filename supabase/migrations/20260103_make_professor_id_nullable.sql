-- =====================================================
-- MIGRAÇÃO: Permitir atribuição sem professor (Pendências) e Corrigir RLS
-- Data: 2026-01-03
-- =====================================================

-- 1. Alterar assigned_packages_log para permitir professor_id nulo
ALTER TABLE public.assigned_packages_log 
ALTER COLUMN professor_id DROP NOT NULL;

COMMENT ON COLUMN public.assigned_packages_log.professor_id IS 'ID do professor titular (pode ser NULL para gerar pendência)';

-- 2. Garantir que appointments também permite professor_id nulo (para pendências de aulas)
ALTER TABLE public.appointments 
ALTER COLUMN professor_id DROP NOT NULL,
ALTER COLUMN class_slot_id DROP NOT NULL;

COMMENT ON COLUMN public.appointments.professor_id IS 'ID do professor (NULL = pendência)';
COMMENT ON COLUMN public.appointments.class_slot_id IS 'ID do slot (NULL = pendência)';

-- 3. Atualizar RLS de assigned_packages_log para incluir administradores (Role 'admin')
-- Primeiro garantimos que a função de verificação existe (já deve existir de migrações anteriores)
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-criar a política para assigned_packages_log
DROP POLICY IF EXISTS "Enable manage for owner and superadmins" ON public.assigned_packages_log;
CREATE POLICY "Enable manage for owner and superadmins" 
ON public.assigned_packages_log
FOR ALL
TO authenticated
USING (
    auth.uid() = professor_id 
    OR 
    public.is_admin_or_superadmin()
)
WITH CHECK (
    auth.uid() = professor_id 
    OR 
    public.is_admin_or_superadmin()
);

-- Garantir acesso ao histórico para alunos (já existia mas reforçamos)
DROP POLICY IF EXISTS "Students can view their own package logs" ON public.assigned_packages_log;
CREATE POLICY "Students can view their own package logs"
ON public.assigned_packages_log
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);
