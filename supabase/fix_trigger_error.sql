-- CORREÇÃO DE TRIGGER 'NEW.ID'

-- O erro "record new has no field id" indica que existe um TRIGGER (gatilho) automático nesta tabela
-- que está tentando acessar um campo 'id', mas a tabela provavelmente usa 'solicitud_id'.

-- 1. Tente remover triggers comuns de timestamp que podem estar errados
DROP TRIGGER IF EXISTS handle_updated_at ON public.solicitudes_clase;
DROP TRIGGER IF EXISTS set_updated_at ON public.solicitudes_clase;
DROP TRIGGER IF EXISTS update_solicitudes_clase_modtime ON public.solicitudes_clase;

-- 2. Se você tem uma função genérica 'moddatetime' ou similar, ela pode estar falhando.
-- Vamos recriar o trigger de updated_at de forma segura, se a coluna updated_at existir.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes_clase' AND column_name = 'updated_at') THEN
        
        -- Remover trigger anterior se existir
        DROP TRIGGER IF EXISTS update_solicitudes_clase_updated_at ON public.solicitudes_clase;
        
        -- Criar uma função específica para essa tabela que usa o nome correto da PK (ou não precisa da PK para update de data)
        CREATE OR REPLACE FUNCTION update_solicitudes_updated_at()
        RETURNS TRIGGER AS '
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        ' LANGUAGE plpgsql;

        -- Aplicar o novo trigger seguro
        CREATE TRIGGER update_solicitudes_clase_updated_at
        BEFORE UPDATE ON public.solicitudes_clase
        FOR EACH ROW
        EXECUTE PROCEDURE update_solicitudes_updated_at();
        
    END IF;
END $$;
