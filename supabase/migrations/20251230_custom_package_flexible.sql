-- =====================================================
-- MIGRACIÓN: Estrutura para Pacote Personalizado Flexível
-- =====================================================

-- 1. Altera a tabela profiles para armazenar a rotina semanal preferida do aluno
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_schedule JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.preferred_schedule IS 'Rotina semanal preferida do aluno: {dayIndex: "HH:mm"}';

-- 2. Altera a tabela billing para suportar nome de pacote customizado
ALTER TABLE public.billing 
ADD COLUMN IF NOT EXISTS custom_package_name TEXT;

COMMENT ON COLUMN public.billing.custom_package_name IS 'Nome opcional para sobrescrever o nome do pacote padrão';

-- 3. Altera a tabela assigned_packages_log para suportar nome de pacote customizado
ALTER TABLE public.assigned_packages_log 
ADD COLUMN IF NOT EXISTS custom_package_name TEXT;

COMMENT ON COLUMN public.assigned_packages_log.custom_package_name IS 'Nome opcional para sobrescrever o nome do pacote padrão no histórico';
