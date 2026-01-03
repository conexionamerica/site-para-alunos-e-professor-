-- Migração para implementação de Logs de Auditoria e Sistema de Reversão (Undo)

-- 1. Criação da tabela de logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_code SERIAL,                     -- Código sequencial único e fácil de ler
    table_name TEXT NOT NULL,            -- Nome da tabela afetada
    record_id TEXT,                      -- ID do registro afetado (armazenado como texto para suportar UUID e INT)
    action TEXT NOT NULL,                -- INSERT, UPDATE, DELETE, INITIAL
    old_data JSONB,                      -- Dados antes da alteração
    new_data JSONB,                      -- Dados após a alteração
    changed_by UUID REFERENCES profiles(id), -- Usuário que realizou a ação
    history TEXT,                        -- Descrição legível do que foi feito
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que a coluna record_id seja TEXT (caso a tabela já exista com UUID)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='audit_logs' AND column_name='record_id' AND data_type='uuid'
    ) THEN
        ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 2. Função genérica de captura de auditoria
CREATE OR REPLACE FUNCTION process_audit_log() 
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_history TEXT;
    v_record_id TEXT;
    v_full_name TEXT;
    v_log_code INTEGER;
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

    -- Determina o record_id (usa sempre a coluna 'id' convertida para TEXT)
    IF (TG_OP = 'DELETE') THEN
        v_record_id := OLD.id::TEXT;
    ELSE
        v_record_id := NEW.id::TEXT;
    END IF;

    -- Gera histórico amigável com detalhes contextuais
    v_history := TG_TABLE_NAME || ' - ' || TG_OP || ' realizada';
    IF v_full_name IS NOT NULL THEN
        v_history := v_history || ' por ' || v_full_name;
    END IF;
    
    -- Adiciona detalhes contextuais baseados na tabela (usando JSONB para evitar erros de campos inexistentes)
    IF TG_OP != 'DELETE' THEN
        DECLARE
            v_new_json JSONB := to_jsonb(NEW);
            v_comment TEXT;
            v_reason TEXT;
            v_obs TEXT;
            v_content TEXT;
            v_notes TEXT;
        BEGIN
            -- Para class_feedback, inclui o comentário
            IF TG_TABLE_NAME = 'class_feedback' THEN
                v_comment := v_new_json->>'comment';
                IF v_comment IS NOT NULL AND v_comment != '' THEN
                    v_history := v_history || ' | Comentário: ' || LEFT(v_comment, 200);
                END IF;
            END IF;
            
            -- Para appointments com observação de reagendamento
            IF TG_TABLE_NAME = 'appointments' THEN
                v_reason := v_new_json->>'reschedule_reason';
                IF v_reason IS NOT NULL AND v_reason != '' THEN
                    v_history := v_history || ' | Motivo: ' || LEFT(v_reason, 200);
                END IF;
            END IF;
            
            -- Para assigned_packages_log com observação
            IF TG_TABLE_NAME = 'assigned_packages_log' THEN
                v_obs := v_new_json->>'observation';
                IF v_obs IS NOT NULL AND v_obs != '' THEN
                    v_history := v_history || ' | Obs: ' || LEFT(v_obs, 200);
                END IF;
            END IF;
            
            -- Para student_messages
            IF TG_TABLE_NAME = 'student_messages' THEN
                v_content := v_new_json->>'content';
                IF v_content IS NOT NULL THEN
                    v_history := v_history || ' | Mensagem: ' || LEFT(v_content, 100);
                END IF;
            END IF;
            
            -- Para billing com notas
            IF TG_TABLE_NAME = 'billing' THEN
                v_notes := v_new_json->>'notes';
                IF v_notes IS NOT NULL AND v_notes != '' THEN
                    v_history := v_history || ' | Notas: ' || LEFT(v_notes, 200);
                END IF;
            END IF;
        END;
    END IF;

    -- Insere na tabela de logs
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by, history)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(NEW), v_user_id, v_history)
        RETURNING log_code INTO v_log_code; 
        
        -- Atualiza o registro original com o código do log
        IF v_log_code IS NOT NULL AND pg_trigger_depth() < 2 THEN
            EXECUTE format('UPDATE %I SET last_log_code = $1 WHERE id = $2', TG_TABLE_NAME)
            USING v_log_code, NEW.id;
        END IF;

        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Evita recursão se for apenas atualização do last_log_code
        IF pg_trigger_depth() > 1 THEN
            RETURN NEW;
        END IF;

        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by, history)
        VALUES (TG_TABLE_NAME, v_record_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), v_user_id, v_history)
        RETURNING log_code INTO v_log_code;

        -- Atualiza o registro original
        IF v_log_code IS NOT NULL THEN
            EXECUTE format('UPDATE %I SET last_log_code = $1 WHERE id = $2', TG_TABLE_NAME)
            USING v_log_code, NEW.id;
        END IF;

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
    tables_to_audit TEXT[] := ARRAY['profiles', 'appointments', 'billing', 'class_slots', 'assigned_packages_log', 'student_messages', 'financial_titles', 'class_feedback'];
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

-- 4. Captura de Carga Inicial (Snapshots dos dados atuais)
-- Isso cria um log para cada registro que já existe no sistema
DO $$
DECLARE
    t TEXT;
    tables_to_audit TEXT[] := ARRAY['profiles', 'appointments', 'billing', 'class_slots', 'assigned_packages_log', 'student_messages', 'financial_titles', 'class_feedback'];
BEGIN
    FOREACH t IN ARRAY tables_to_audit LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Insere um log 'INITIAL' para registros que ainda não possuem log code
            EXECUTE format('
                INSERT INTO audit_logs (table_name, record_id, action, new_data, history)
                SELECT %L, id::text, %L, to_jsonb(r), %L || id::text 
                FROM %I r
                WHERE last_log_code IS NULL', 
                t, 'INITIAL', 'Carga inicial do registro ', t);
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
            
        WHEN 'INITIAL' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Registros de carga inicial não podem ser revertidos automaticamente por segurança.');
            
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'Tipo de ação não suportada para reversão automática: ' || v_log.action);
    END CASE;

    -- Registra no próprio log que ele foi revertido (ou deleta o log? melhor manter e marcar)
    UPDATE audit_logs SET history = history || ' [REVERTIDO EM ' || NOW() || ']' WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true, 'message', 'Operação revertida com sucesso');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Erro ao reverter: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
