-- =====================================================
-- MIGRAÇÃO: Sistema de Títulos Financeiros
-- Data: 2026-01-03
-- Descrição: Criação de tabela para gerenciar títulos
--            de recebimentos (alunos) e pagamentos (professores)
-- =====================================================

-- =====================================================
-- TABELA: financial_titles
-- =====================================================

CREATE TABLE IF NOT EXISTS financial_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Número do título (único e sequencial)
    title_number VARCHAR(20) UNIQUE NOT NULL,
    
    -- Tipo: receivable (recebimento de aluno) ou payable (pagamento a professor)
    title_type VARCHAR(20) NOT NULL CHECK (title_type IN ('receivable', 'payable')),
    
    -- ===== Dados do titular =====
    holder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    holder_name TEXT NOT NULL,
    holder_cpf VARCHAR(14), -- Formato: 000.000.000-00
    
    -- ===== Valores financeiros =====
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    payment_date TIMESTAMP WITH TIME ZONE, -- Data efetiva do pagamento
    due_date TIMESTAMP WITH TIME ZONE, -- Data de vencimento
    
    -- ===== Status do título =====
    -- pending: Aguarda pagamento
    -- effective: Pago e dentro do período de validade
    -- closed: Finalizado (período de uso encerrado)
    -- cancelled: Cancelado
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'effective', 'closed', 'cancelled')),
    
    -- ===== Referências =====
    billing_id UUID REFERENCES billing(id) ON DELETE SET NULL, -- Para recebimentos de alunos
    package_id UUID, -- Pacote relacionado
    reference_month DATE, -- Mês de referência (para pagamentos mensais a professores)
    
    -- ===== Metadata e Auditoria =====
    notes TEXT, -- Observações adicionais
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    -- ===== Constraints adicionais =====
    CONSTRAINT valid_dates CHECK (
        payment_date IS NULL OR 
        due_date IS NULL OR 
        payment_date >= due_date - INTERVAL '365 days'
    )
);

-- =====================================================
-- ÍNDICES para melhor performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_financial_titles_type 
ON financial_titles(title_type);

CREATE INDEX IF NOT EXISTS idx_financial_titles_status 
ON financial_titles(status);

CREATE INDEX IF NOT EXISTS idx_financial_titles_holder 
ON financial_titles(holder_id);

CREATE INDEX IF NOT EXISTS idx_financial_titles_month 
ON financial_titles(reference_month) 
WHERE reference_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_titles_billing 
ON financial_titles(billing_id) 
WHERE billing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_titles_created_at 
ON financial_titles(created_at DESC);

-- =====================================================
-- FUNÇÃO: Gerar número de título único
-- =====================================================

CREATE OR REPLACE FUNCTION generate_title_number(p_title_type VARCHAR)
RETURNS VARCHAR(20) AS $$
DECLARE
    prefix VARCHAR(4);
    year_suffix VARCHAR(4);
    last_sequence INTEGER;
    new_sequence INTEGER;
    new_title_number VARCHAR(20);
BEGIN
    -- Definir prefixo baseado no tipo
    IF p_title_type = 'receivable' THEN
        prefix := 'REC';
    ELSIF p_title_type = 'payable' THEN
        prefix := 'PAG';
    ELSE
        RAISE EXCEPTION 'Tipo de título inválido: %', p_title_type;
    END IF;
    
    -- Ano atual
    year_suffix := TO_CHAR(NOW(), 'YYYY');
    
    -- Buscar último número da sequência para o ano e tipo
    SELECT COALESCE(
        MAX(
            CAST(
                SUBSTRING(title_number FROM '[0-9]+$') 
                AS INTEGER
            )
        ), 
        0
    ) INTO last_sequence
    FROM financial_titles
    WHERE title_type = p_title_type
        AND title_number LIKE prefix || '-' || year_suffix || '-%';
    
    -- Incrementar sequência
    new_sequence := last_sequence + 1;
    
    -- Formatar: PREFIX-YYYY-000001
    new_title_number := prefix || '-' || year_suffix || '-' || LPAD(new_sequence::TEXT, 6, '0');
    
    RETURN new_title_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION update_financial_titles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_financial_titles_timestamp ON financial_titles;

CREATE TRIGGER trigger_update_financial_titles_timestamp
BEFORE UPDATE ON financial_titles
FOR EACH ROW
EXECUTE FUNCTION update_financial_titles_timestamp();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

ALTER TABLE financial_titles ENABLE ROW LEVEL SECURITY;

-- Superadmins podem ver e editar tudo
CREATE POLICY "Superadmins can view all financial titles"
ON financial_titles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

CREATE POLICY "Superadmins can insert financial titles"
ON financial_titles FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

CREATE POLICY "Superadmins can update financial titles"
ON financial_titles FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'superadmin'
    )
);

-- Professores podem ver apenas seus próprios títulos de pagamento
CREATE POLICY "Professors can view their own payable titles"
ON financial_titles FOR SELECT
USING (
    title_type = 'payable' 
    AND holder_id = auth.uid()
);

-- =====================================================
-- COMENTÁRIOS para documentação
-- =====================================================

COMMENT ON TABLE financial_titles IS 'Gerenciamento de títulos financeiros (recebimentos de alunos e pagamentos a professores)';
COMMENT ON COLUMN financial_titles.title_number IS 'Número único do título no formato PREFIX-YYYY-000001';
COMMENT ON COLUMN financial_titles.title_type IS 'Tipo de título: receivable (recebimento) ou payable (pagamento)';
COMMENT ON COLUMN financial_titles.status IS 'Status: pending, effective, closed, cancelled';
COMMENT ON COLUMN financial_titles.billing_id IS 'Referência à fatura do aluno (para recebimentos)';
COMMENT ON COLUMN financial_titles.reference_month IS 'Mês de referência para pagamentos mensais';

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
