-- Script para verificar e corrigir políticas RLS na tabela mensajes
-- Este script deve ser executado no painel do Supabase (SQL Editor)

-- 1. Verificar se a coluna 'leido' existe na tabela mensajes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mensajes' AND column_name = 'leido'
    ) THEN
        -- Adicionar coluna leido se não existir
        ALTER TABLE mensajes ADD COLUMN leido BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna "leido" adicionada à tabela mensajes';
    ELSE
        RAISE NOTICE 'Coluna "leido" já existe na tabela mensajes';
    END IF;
END $$;

-- 2. Garantir que a coluna tenha valor padrão FALSE
ALTER TABLE mensajes ALTER COLUMN leido SET DEFAULT FALSE;

-- 3. Atualizar mensagens antigas que não têm valor definido
UPDATE mensajes SET leido = FALSE WHERE leido IS NULL;

-- 4. Verificar políticas RLS existentes na tabela mensajes
SELECT 
    policyname,
    tablename,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'mensajes';

-- 5. Criar política para permitir UPDATE do campo leido se não existir
-- Primeiro, remover política existente se houver conflito
DROP POLICY IF EXISTS "mensajes_update_leido_policy" ON mensajes;

-- Criar nova política permitindo UPDATE
CREATE POLICY "mensajes_update_leido_policy"
ON mensajes
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. Garantir que RLS está habilitado mas com políticas permissivas
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- 7. Criar política de SELECT se não existir
DROP POLICY IF EXISTS "mensajes_select_policy" ON mensajes;
CREATE POLICY "mensajes_select_policy"
ON mensajes
FOR SELECT
USING (true);

-- 8. Criar política de INSERT se não existir
DROP POLICY IF EXISTS "mensajes_insert_policy" ON mensajes;
CREATE POLICY "mensajes_insert_policy"
ON mensajes
FOR INSERT
WITH CHECK (true);

COMMENT ON COLUMN mensajes.leido IS 'Indica se a mensagem foi lida pelo destinatário';
