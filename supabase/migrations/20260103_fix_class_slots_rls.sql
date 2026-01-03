-- =====================================================
-- MIGRAÇÃO: Corrigir RLS da tabela class_slots
-- Data: 2026-01-03
-- Descrição: Permite que Superadmins gerenciem horários
--            de qualquer professor.
-- =====================================================

-- 1. Garantir que RLS está habilitado
ALTER TABLE public.class_slots ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Professors can manage their own slots" ON public.class_slots;
DROP POLICY IF EXISTS "Superadmins can manage all slots" ON public.class_slots;
DROP POLICY IF EXISTS "Anyone can view active slots" ON public.class_slots;
DROP POLICY IF EXISTS "Allow all for admin" ON public.class_slots;

-- 3. CRIAR NOVAS POLÍTICAS

-- POLICY: Qualquer usuário autenticado pode ver os horários (necessário para agendamento)
CREATE POLICY "Anyone can view slots"
ON public.class_slots FOR SELECT
TO authenticated
USING (true);

-- POLICY: Professores gerenciam seus PRÓPRIOS horários
CREATE POLICY "Professors can manage their own slots"
ON public.class_slots FOR ALL
TO authenticated
USING (auth.uid() = professor_id)
WITH CHECK (auth.uid() = professor_id);

-- POLICY: Superadmins e Admins gerenciam QUALQUER horário
-- Usando a função segura is_admin_or_superadmin() que já existe no banco
CREATE POLICY "Superadmins can manage all slots"
ON public.class_slots FOR ALL
TO authenticated
USING (public.is_admin_or_superadmin())
WITH CHECK (public.is_admin_or_superadmin());

-- Comentário para documentação
COMMENT ON TABLE public.class_slots IS 'Horários de aula dos professores. Gerenciável por professores e administradores.';
