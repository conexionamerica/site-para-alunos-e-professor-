-- =====================================================
-- MIGRAÇÃO: Adicionar campo pending_professor_id
-- Data: 2026-01-06
-- Descrição: Adiciona campo para rastrear solicitação
--            de vinculação pendente com professor
-- =====================================================

-- Adicionar coluna para professor pendente de aprovação
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_professor_id UUID REFERENCES auth.users(id);

-- Adicionar coluna para status da solicitação de vinculação
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_professor_status TEXT DEFAULT NULL;
-- Valores possíveis: 'aguardando_aprovacao', 'aprovado', 'rejeitado', NULL

-- Adicionar coluna para data da solicitação
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_professor_requested_at TIMESTAMPTZ DEFAULT NULL;

-- Criar índice para busca mais rápida
CREATE INDEX IF NOT EXISTS idx_profiles_pending_professor_id 
ON public.profiles(pending_professor_id) 
WHERE pending_professor_id IS NOT NULL;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
