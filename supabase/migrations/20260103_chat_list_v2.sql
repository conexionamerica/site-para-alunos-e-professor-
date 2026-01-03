-- Migração para fornecer lista de chats para administradores e professores
-- Suporta filtragem por professor ou retorno de todas as conversas

CREATE OR REPLACE FUNCTION get_chat_list_v2(p_prof_id UUID DEFAULT NULL)
RETURNS TABLE (
    chat_id UUID,
    alumno_id UUID,
    alumno_full_name TEXT,
    alumno_avatar_url TEXT,
    profesor_id UUID,
    profesor_full_name TEXT,
    last_message_content TEXT,
    last_message_time TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH last_messages AS (
        SELECT DISTINCT ON (m.chat_id)
            m.chat_id,
            m.contenido as content,
            m.enviado_en as sent_at
        FROM mensajes m
        ORDER BY m.chat_id, m.enviado_en DESC
    )
    SELECT 
        c.chat_id,
        c.alumno_id,
        p_student.full_name as alumno_full_name,
        p_student.avatar_url as alumno_avatar_url,
        c.profesor_id,
        p_prof.full_name as profesor_full_name,
        lm.content as last_message_content,
        lm.sent_at as last_message_time
    FROM chats c
    LEFT JOIN profiles p_student ON c.alumno_id = p_student.id
    LEFT JOIN profiles p_prof ON c.profesor_id = p_prof.id
    LEFT JOIN last_messages lm ON c.chat_id = lm.chat_id
    WHERE (p_prof_id IS NULL OR c.profesor_id = p_prof_id)
    ORDER BY last_message_time DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Também criar uma versão que ignora permissão de professor para admins
-- (Já coberto pelo parâmetro DEFAULT NULL, mas garantindo acesso facilitado)
