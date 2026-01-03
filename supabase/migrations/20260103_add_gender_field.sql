-- =====================================================
-- MIGRAÇÃO: Adicionar Campo Gênero
-- Data: 2026-01-03
-- Descrição: Adiciona campo gender à tabela profiles
-- =====================================================

-- Adicionar campo gender
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) 
CHECK (gender IN ('masculino', 'feminino', 'outro', 'prefiro_nao_informar'));

COMMENT ON COLUMN profiles.gender IS 'Gênero do usuário: masculino, feminino, outro ou prefiro_nao_informar';

-- Verificação
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'gender';
