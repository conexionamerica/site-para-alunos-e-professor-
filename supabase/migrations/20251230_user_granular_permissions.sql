-- =====================================================
-- MIGRACIÓN: Permissões Granulares por Perfil de Usuário
-- Permite definir se um usuário pode ver/usar a coluna de ações
-- =====================================================

-- 1. Adiciona as colunas de permissão à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_manage_classes BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS can_manage_students BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.profiles.can_manage_classes IS 'Define se o usuário tem acesso às ações na aba de Aulas';
COMMENT ON COLUMN public.profiles.can_manage_students IS 'Define se o usuário tem acesso às ações na aba de Alunos';
