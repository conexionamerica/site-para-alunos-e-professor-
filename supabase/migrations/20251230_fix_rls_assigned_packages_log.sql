-- =====================================================
-- MIGRACIÓN: Corrigir RLS para assigned_packages_log
-- Permite que Superadmins insiram e gerenciem logs de qualquer professor
-- =====================================================

-- 1. Garantir que RLS está habilitado
ALTER TABLE public.assigned_packages_log ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Professors can update assigned_packages_log" ON public.assigned_packages_log;
DROP POLICY IF EXISTS "Allow all on assigned_packages_log" ON public.assigned_packages_log;
DROP POLICY IF EXISTS "Superadmin management on assigned_packages_log" ON public.assigned_packages_log;

-- 3. Criar política unificada para ALL (SELECT, INSERT, UPDATE, DELETE)
-- Esta política permite acesso se o usuário for o professor do registro OU se for um superadmin
CREATE POLICY "Enable manage for owner and superadmins" 
ON public.assigned_packages_log
FOR ALL
TO authenticated
USING (
    auth.uid() = professor_id 
    OR 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'superadmin'
    )
)
WITH CHECK (
    auth.uid() = professor_id 
    OR 
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'superadmin'
    )
);

-- 4. Opcionalmente, garantir permissões de SELECT para o próprio aluno (para ver seu histórico)
DROP POLICY IF EXISTS "Students can view their own package logs" ON public.assigned_packages_log;
CREATE POLICY "Students can view their own package logs"
ON public.assigned_packages_log
FOR SELECT
TO authenticated
USING (
    auth.uid() = student_id
);

-- Comentário para documentação
COMMENT ON TABLE public.assigned_packages_log IS 'Log de pacotes atribuídos. Gerenciável por professores (próprios) e superadmins (todos).';
