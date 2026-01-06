-- RPC PARA EXCLUSÃO TOTAL (V5)
-- Adicionado: Limpeza de 'audit_logs' que bloqueava a exclusão (FK audit_logs_changed_by_fkey)

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. CHAT E MENSAGENS
  DELETE FROM mensajes WHERE remitente_id = p_user_id;
  DELETE FROM mensajes 
  WHERE chat_id IN (SELECT chat_id FROM chats WHERE alumno_id = p_user_id OR profesor_id = p_user_id);
  DELETE FROM chats WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 2. NOTIFICAÇÕES
  BEGIN
    DELETE FROM notifications WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 3. AULAS (Appointments) - Liberação de slots
  WITH student_classes AS (
      SELECT class_datetime, professor_id
      FROM appointments 
      WHERE student_id = p_user_id 
        AND status IN ('scheduled', 'pending', 'confirmed')
        AND professor_id IS NOT NULL
  ),
  slots_to_release AS (
      SELECT cs.id
      FROM class_slots cs
      JOIN student_classes sc 
        ON cs.professor_id = sc.professor_id 
        AND cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
        AND cs.start_time = (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')::time
      WHERE cs.status = 'filled'
  )
  UPDATE class_slots
  SET status = 'active'
  WHERE id IN (SELECT id FROM slots_to_release);

  -- 4. MATERIAIS E FEEDBACKS
  DELETE FROM class_feedback WHERE student_id = p_user_id;
  DELETE FROM class_materials WHERE student_id = p_user_id;

  -- 5. FINANCEIRO E AUDITORIA (Correção do erro atual)
  DELETE FROM billing WHERE user_id = p_user_id; 
  DELETE FROM audit_logs WHERE changed_by = p_user_id; -- Remove logs gerados por este usuário
  
  BEGIN
    DELETE FROM financial_titles WHERE student_id = p_user_id; 
  EXCEPTION WHEN OTHERS THEN NULL; END;
  
  BEGIN
    DELETE FROM invoices WHERE user_id = p_user_id; 
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 6. AULAS, SOLICITAÇÕES
  DELETE FROM appointments WHERE student_id = p_user_id OR professor_id = p_user_id;
  DELETE FROM solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 7. LOGS E SLOTS
  DELETE FROM class_slots WHERE professor_id = p_user_id;
  DELETE FROM assigned_packages_log WHERE student_id = p_user_id;
  UPDATE assigned_packages_log SET professor_id = NULL WHERE professor_id = p_user_id;

  -- 8. TAREFAS
  BEGIN
     DELETE FROM student_tasks WHERE student_id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 9. PERFIL E AUTH
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql;
