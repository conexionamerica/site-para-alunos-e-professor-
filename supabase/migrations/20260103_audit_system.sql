-- Migração para implementação de Logs de Auditoria e Sistema de Reversão (Undo)

-- 1. Criação da tabela de logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_code SERIAL,                     -- Código sequencial único e fácil de ler
    table_name TEXT NOT NULL,            -- Nome da tabela afetada
    record_id UUID,                      -- ID do registro afetado
    action TEXT NOT NULL,                -- INSERT, UPDATE, DELETE
    old_data JSONB,                      -- Dados antes da alteração
    new_data JSONB,                      -- Dados após a alteração
    changed_by UUID REFERENCES profiles(id), -- Usuário que realizou a ação
    history TEXT,                        -- Descrição legível do que foi feito
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 2. Função genérica de captura de auditoria
CREATE OR REPLACE FUNCTION process_audit_log() 
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_history TEXT;
    v_record_id UUID;
    v_full_name TEXT;
BEGIN
    -- Tenta pegar o ID do usuário da sessão do Supabase/PostgREST
    BEGIN
        v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Tenta pegar o nome do usuário para o histórico
    IF v_user_id IS NOT NULL THEN
        SELECT full_name INTO v_full_name FROM profiles WHERE id = v_user_id;
    END IF;

    -- Determina o record_id (geralmente a coluna 'id', ajustando para tabelas com nomes diferentes)
    IF (TG_OP = 'DELETE') THEN
        -- Tenta pegar o ID do registro (assume 'id' ou o primeiro campo UUID)
        v_record_id := CASE 
            WHEN (OLD.id IS NOT NULL) THEN OLD.id 
            WHEN (TG_TABLE_NAME = 'solicitudes_clase') THEN OLD.solicitud_id
            WHEN (TG_TABLE_NAME = 'mensajes') THEN OLD.mensaje_id
            WHEN (TG_TABLE_NAME = 'chats') THEN OLD.chat_id
            ELSE NULL 
        END;
    ELSE
        v_record_id := CASE 
            WHEN (NEW.id IS NOT NULL) THEN NEW.id 
            WHEN (TG_TABLE_NAME = 'solicitudes_clase') THEN NEW.solicitud_id
            WHEN (TG_TABLE_NAME = 'mensajes') THEN NEW.mensaje_id
            WHEN (TG_TABLE_NAME = 'chats') THEN NEW.chat_id
            ELSE NULL 
        END;
    END IF;

    -- Gera histórico amigável
    v_history := TG_TABLE_NAME || ' - ' || TG_OP || ' realizada';
    IF v_full_name IS NOT NULL THEN
        v_history := v_history || ' por ' || v_full_name;
    END IF;

    -- Insere na tabela de logs
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, history)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(NEW), v_user_id, v_history)
        RETURNING log_code INTO v_record_id; 
        
        -- Atualiza o registro original com o código do log
        -- Usamos v_record_id apenas para o UPDATE, não para o ID real
        IF v_record_id IS NOT NULL THEN
             -- Evita recursão disparando o trigger novamente
            IF pg_trigger_depth() < 2 THEN
                EXECUTE format('UPDATE %I SET last_log_code = %L WHERE %I = %L', TG_TABLE_NAME, v_record_id, 
                               CASE WHEN TG_TABLE_NAME = 'solicitudes_clase' THEN 'solicitud_id' ELSE 'id' END, 
                               CASE WHEN TG_TABLE_NAME = 'solicitudes_clase' THEN NEW.solicitud_id ELSE NEW.id END);
            END IF;
        END IF;

        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Evita recursão se for apenas atualização do last_log_code
        IF pg_trigger_depth() > 1 THEN
            RETURN NEW;
        END IF;

        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, history)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), v_user_id, v_history)
        RETURNING log_code INTO v_record_id;

        -- Atualiza o registro original
        EXECUTE format('UPDATE %I SET last_log_code = %L WHERE %I = %L', TG_TABLE_NAME, v_record_id, 
                       CASE WHEN TG_TABLE_NAME = 'solicitudes_clase' THEN 'solicitud_id' ELSE 'id' END, 
                       CASE WHEN TG_TABLE_NAME = 'solicitudes_clase' THEN NEW.solicitud_id ELSE NEW.id END);

        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by, history)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(OLD), v_user_id, v_history);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Aplicar trigger nas tabelas principais
-- Nota: Para simplificar, listamos as principais de movimentação.
-- Adicione mais tabelas conforme necessário.

DO $$
DECLARE
    t TEXT;
    tables_to_audit TEXT[] := ARRAY['profiles', 'appointments', 'billing', 'class_slots', 'solicitudes_clase', 'assigned_packages_log', 'student_messages', 'financial_titles'];
BEGIN
    FOREACH t IN ARRAY tables_to_audit LOOP
        -- Verifica se a tabela existe antes de tentar alterá-la
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Adicionar coluna de código de log se não existir
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS last_log_code INTEGER', t);
            
            EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', t, t);
            EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION process_audit_log()', t, t);
        ELSE
            RAISE NOTICE 'Tabela % não encontrada, pulando auditoria para esta tabela.', t;
        END IF;
    END LOOP;
END $$;

-- 4. Função de reversão (UNDO)
CREATE OR REPLACE FUNCTION reverse_audit_log(p_log_id UUID) 
RETURNS JSONB AS $$
DECLARE
    v_log audit_logs;
    v_sql TEXT;
    v_key_col TEXT;
BEGIN
    -- Busca o log
    SELECT * INTO v_log FROM audit_logs WHERE id = p_log_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Log não encontrado');
    END IF;

    -- Define a coluna de chave primária baseado na tabela
    v_key_col := CASE 
        WHEN (v_log.table_name = 'solicitudes_clase') THEN 'solicitud_id'
        WHEN (v_log.table_name = 'mensajes') THEN 'mensaje_id'
        WHEN (v_log.table_name = 'chats') THEN 'chat_id'
        ELSE 'id' 
    END;

    -- Lógica de reversão
    CASE v_log.action
        WHEN 'INSERT' THEN
            -- Reverter INSERT é deletar o registro novo
            v_sql := format('DELETE FROM %I WHERE %I = %L', v_log.table_name, v_key_col, v_log.record_id);
            EXECUTE v_sql;
            
        WHEN 'UPDATE' THEN
            -- Reverter UPDATE é restaurar old_data
            -- Usamos jsonb_populate_record para converter json em record e atualizar
            v_sql := format('UPDATE %I SET (%s) = (SELECT * FROM jsonb_populate_record(NULL::%I, %L)) WHERE %I = %L', 
                            v_log.table_name, 
                            (SELECT string_agg(quote_ident(key), ',') FROM jsonb_each(v_log.old_data)),
                            v_log.table_name, 
                            v_log.old_data, 
                            v_key_col, 
                            v_log.record_id);
            EXECUTE v_sql;
            
        WHEN 'DELETE' THEN
            -- Reverter DELETE é inserir old_data de volta
            v_sql := format('INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, %L)', 
                            v_log.table_name, v_log.table_name, v_log.old_data);
            EXECUTE v_sql;
    END CASE;

    -- Registra no próprio log que ele foi revertido (ou deleta o log? melhor manter e marcar)
    UPDATE audit_logs SET history = history || ' [REVERTIDO EM ' || NOW() || ']' WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true, 'message', 'Operação revertida com sucesso');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Erro ao reverter: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
