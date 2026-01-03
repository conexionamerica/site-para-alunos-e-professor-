-- =====================================================
-- MIGRAÇÃO: Adicionar Campos de Dados Pessoais
-- Data: 2026-01-03
-- Descrição: Adiciona campos para suportar pré-cadastro
--            e cadastro completo de pessoas
-- =====================================================

-- =====================================================
-- PASSO 1: Adicionar novos campos à tabela profiles
-- =====================================================

-- Status de registro (pré-cadastro ou completo)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'pre_registered' 
CHECK (registration_status IN ('pre_registered', 'complete'));

-- Dados pessoais básicos
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Endereço completo
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_street TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_number VARCHAR(10);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_complement TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT;

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_state VARCHAR(2);

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS address_zip_code VARCHAR(10);

-- =====================================================
-- PASSO 2: Criar índice único para CPF
-- =====================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cpf 
ON profiles(cpf) 
WHERE cpf IS NOT NULL;

COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário - formato 000.000.000-00 (único quando preenchido)';
COMMENT ON COLUMN profiles.phone IS 'Telefone de contato';
COMMENT ON COLUMN profiles.registration_status IS 'Status do cadastro: pre_registered ou complete';

-- =====================================================
-- PASSO 3: Atualizar usuários existentes
-- Professores e superadmins: status = complete
-- Students: mantém pre_registered (será completado depois)
-- =====================================================

UPDATE profiles 
SET registration_status = 'complete'
WHERE role IN ('professor', 'superadmin');

-- =====================================================
-- PASSO 4: Criar função para auto-definir status
-- =====================================================

CREATE OR REPLACE FUNCTION set_registration_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Professores e superadmins sempre têm cadastro completo
  IF NEW.role IN ('professor', 'superadmin') THEN
    NEW.registration_status := 'complete';
  -- Se for student e tiver CPF, marcar como completo
  ELSIF NEW.role = 'student' AND NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    NEW.registration_status := 'complete';
  -- Caso contrário, pré-cadastro
  ELSIF NEW.role = 'student' THEN
    NEW.registration_status := COALESCE(NEW.registration_status, 'pre_registered');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASSO 5: Criar triggers
-- =====================================================

-- Trigger para INSERT
DROP TRIGGER IF EXISTS trigger_set_registration_status_insert ON profiles;

CREATE TRIGGER trigger_set_registration_status_insert
BEFORE INSERT ON profiles
FOR EACH ROW 
EXECUTE FUNCTION set_registration_status();

-- Trigger para UPDATE (quando CPF é adicionado)
DROP TRIGGER IF EXISTS trigger_set_registration_status_update ON profiles;

CREATE TRIGGER trigger_set_registration_status_update
BEFORE UPDATE ON profiles
FOR EACH ROW 
WHEN (OLD.cpf IS DISTINCT FROM NEW.cpf OR OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION set_registration_status();

-- =====================================================
-- PASSO 6: Verificação
-- =====================================================

-- Verificar se as colunas foram criadas
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN (
    'registration_status', 'phone', 'cpf', 'birth_date',
    'address_street', 'address_number', 'address_complement',
    'address_neighborhood', 'address_city', 'address_state', 'address_zip_code'
  )
ORDER BY column_name;

-- Verificar status dos usuários
SELECT 
  role,
  registration_status,
  COUNT(*) as quantidade
FROM profiles
GROUP BY role, registration_status
ORDER BY role, registration_status;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
