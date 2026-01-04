-- Migração: Adicionar código único para aulas (appointments)
-- Data: 2026-01-04
-- Descrição: Adiciona um campo 'class_code' para identificar cada aula de forma única e legível

-- 1. Adicionar coluna class_code se não existir
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS class_code TEXT UNIQUE;

-- 2. Criar função para gerar código único de aula
CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TRIGGER AS $$
DECLARE
    v_year TEXT;
    v_sequence INTEGER;
    v_code TEXT;
BEGIN
    -- Extrair ano da data da aula
    v_year := EXTRACT(YEAR FROM NEW.class_datetime)::TEXT;
    
    -- Encontrar o próximo número da sequência para este ano
    SELECT COALESCE(MAX(
        CASE 
            WHEN class_code ~ ('^AULA-' || v_year || '-[0-9]+$') 
            THEN SUBSTRING(class_code FROM 'AULA-' || v_year || '-([0-9]+)')::INTEGER 
            ELSE 0 
        END
    ), 0) + 1
    INTO v_sequence
    FROM appointments
    WHERE class_code LIKE 'AULA-' || v_year || '-%';
    
    -- Gerar código no formato AULA-YYYY-NNNNN
    v_code := 'AULA-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
    
    NEW.class_code := v_code;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para gerar código automaticamente em novos registros
DROP TRIGGER IF EXISTS trg_generate_class_code ON appointments;
CREATE TRIGGER trg_generate_class_code
    BEFORE INSERT ON appointments
    FOR EACH ROW
    WHEN (NEW.class_code IS NULL)
    EXECUTE FUNCTION generate_class_code();

-- 4. Gerar códigos para appointments existentes que não têm código
DO $$
DECLARE
    r RECORD;
    v_year TEXT;
    v_sequence INTEGER;
    v_code TEXT;
BEGIN
    FOR r IN 
        SELECT id, class_datetime 
        FROM appointments 
        WHERE class_code IS NULL 
        ORDER BY class_datetime, id
    LOOP
        -- Extrair ano da data da aula
        v_year := EXTRACT(YEAR FROM r.class_datetime)::TEXT;
        
        -- Encontrar o próximo número da sequência para este ano
        SELECT COALESCE(MAX(
            CASE 
                WHEN class_code ~ ('^AULA-' || v_year || '-[0-9]+$') 
                THEN SUBSTRING(class_code FROM 'AULA-' || v_year || '-([0-9]+)')::INTEGER 
                ELSE 0 
            END
        ), 0) + 1
        INTO v_sequence
        FROM appointments
        WHERE class_code LIKE 'AULA-' || v_year || '-%';
        
        -- Gerar código
        v_code := 'AULA-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
        
        -- Atualizar registro
        UPDATE appointments SET class_code = v_code WHERE id = r.id;
    END LOOP;
END $$;

-- 5. Criar índice para busca rápida pelo código
CREATE INDEX IF NOT EXISTS idx_appointments_class_code ON appointments(class_code);

-- 6. Comentário na coluna
COMMENT ON COLUMN appointments.class_code IS 'Código único da aula no formato AULA-YYYY-NNNNN';
