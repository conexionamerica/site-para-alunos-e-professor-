-- Migration: Create response templates for admins
-- Description: Pre-defined response templates for quick ticket replies

-- Create templates table
CREATE TABLE IF NOT EXISTS ticket_response_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100), -- Related ticket type (optional, NULL = all types)
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_category ON ticket_response_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON ticket_response_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_templates_creator ON ticket_response_templates(created_by);

-- Enable RLS
ALTER TABLE ticket_response_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins gerenciam templates" ON ticket_response_templates;

-- RLS Policy: Only admins can manage templates
CREATE POLICY "Admins gerenciam templates"
ON ticket_response_templates FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin'));

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_template_timestamp ON ticket_response_templates;
CREATE TRIGGER trigger_update_template_timestamp
BEFORE UPDATE ON ticket_response_templates
FOR EACH ROW
EXECUTE FUNCTION update_ticket_timestamp(); -- Reusing function from service_tickets

-- Insert some default templates
INSERT INTO ticket_response_templates (title, content, category, created_by)
SELECT 
    'Aguardando Informações',
    E'Olá!\n\nPara prosseguir com seu atendimento, precisamos de algumas informações adicionais:\n\n- [Descreva o que precisa]\n\nAguardamos seu retorno.\n\nAtenciosamente,\nEquipe de Suporte',
    NULL,
    (SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_response_templates (title, content, category, created_by)
SELECT 
    'Transferência Realizada',
    E'Olá!\n\nA transferência do aluno foi realizada com sucesso.\n\nInformações:\n- Aluno: [Nome]\n- Novo professor: [Nome]\n- Data de início: [Data]\n\nSe tiver alguma dúvida, estamos à disposição.\n\nAtenciosamente,\nEquipe de Suporte',
    'transfer_student',
    (SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_response_templates (title, content, category, created_by)
SELECT 
    'Solicitação em Análise',
    E'Olá!\n\nRecebemos sua solicitação e ela está em análise.\n\nRetornaremos em breve com uma resposta.\n\nAtenciosamente,\nEquipe de Suporte',
    NULL,
    (SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO ticket_response_templates (title, content, category, created_by)
SELECT 
    'Problema Resolvido',
    E'Olá!\n\nSeu problema foi resolvido.\n\nSe ainda persistir ou tiver outras dúvidas, não hesite em abrir um novo ticket.\n\nAtenciosamente,\nEquipe de Suporte',
    NULL,
    (SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'superadmin')
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE ticket_response_templates IS 'Pre-defined response templates for quick ticket replies (admin only)';
COMMENT ON COLUMN ticket_response_templates.category IS 'Optional: ticket type this template applies to (NULL = all types)';

-- Verification
SELECT 'Response templates table created successfully' AS message;
SELECT COUNT(*) || ' default templates inserted' AS message FROM ticket_response_templates;
