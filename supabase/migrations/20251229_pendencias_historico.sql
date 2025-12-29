-- =====================================================
-- MIGRACIÓN: Tabla para histórico de pendencias
-- Almacena pendencias ignoradas por el superusuario
-- =====================================================

-- Crear tabla para histórico de pendencias
CREATE TABLE IF NOT EXISTS pendencias_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL, -- 'sem_professor', 'aulas_disponiveis', 'pacote_vencendo', 'notificacao'
    referencia_id UUID, -- ID del estudiante, billing, o solicitud relacionada
    referencia_tipo VARCHAR(50), -- 'student', 'billing', 'solicitude', 'slot_change'
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    dados_originais JSONB, -- Datos originales de la pendencia para referencia
    acao VARCHAR(20) NOT NULL DEFAULT 'ignorada', -- 'ignorada', 'resolvida'
    ignorado_por UUID REFERENCES profiles(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pendencias_historico_tipo ON pendencias_historico(tipo);
CREATE INDEX IF NOT EXISTS idx_pendencias_historico_ignorado_por ON pendencias_historico(ignorado_por);
CREATE INDEX IF NOT EXISTS idx_pendencias_historico_criado_em ON pendencias_historico(criado_em DESC);

-- Habilitar RLS
ALTER TABLE pendencias_historico ENABLE ROW LEVEL SECURITY;

-- Política: Superadmins pueden ver y modificar todo
CREATE POLICY "Superadmins can manage pendencias_historico"
ON pendencias_historico
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'superadmin'
    )
);

-- Comentarios
COMMENT ON TABLE pendencias_historico IS 'Histórico de pendencias ignoradas o resolvidas por superusuarios';
COMMENT ON COLUMN pendencias_historico.tipo IS 'Tipo de pendencia: sem_professor, aulas_disponiveis, pacote_vencendo, notificacao';
COMMENT ON COLUMN pendencias_historico.acao IS 'Acción tomada: ignorada o resolvida';
