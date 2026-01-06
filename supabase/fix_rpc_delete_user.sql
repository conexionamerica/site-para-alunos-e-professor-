-- RPC PARA EXCLUSÃO TOTAL (V3 - COM LIBERAÇÃO DE SLOTS)
CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
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

  -- 3. AULAS (Appointments)
  -- ### CRÍTICO: LIBERAR SLOTS ANTES DE DELETAR AULAS ###
  -- Se o usuário for ALUNO, libera os horários que ele ocupava na agenda dos professores.
  WITH student_future_classes AS (
      SELECT class_datetime, professor_id
      FROM appointments 
      WHERE student_id = p_user_id 
        AND status IN ('scheduled', 'pending', 'confirmed') -- Apenas aulas ativas ocupam slot
        AND professor_id IS NOT NULL
  ),
  slots_to_release AS (
      SELECT cs.id
      FROM class_slots cs
      JOIN student_future_classes sc 
        ON cs.professor_id = sc.professor_id 
        -- Match Dia da Semana (0-6)
        AND cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
        -- Match Horário
        AND cs.start_time = (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')::time
      WHERE cs.status = 'filled' -- Só libera se estiver ocupado
  )
  UPDATE class_slots
  SET status = 'active'
  WHERE id IN (SELECT id FROM slots_to_release);

  -- Agora pode deletar as aulas
  DELETE FROM appointments WHERE student_id = p_user_id OR professor_id = p_user_id;

  -- 4. SOLICITAÇÕES
  DELETE FROM solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 5. FINANCEIRO
  BEGIN
    DELETE FROM financial_titles WHERE student_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
  
  BEGIN
    DELETE FROM invoices WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
  
  -- 6. SLOTS (Se o usuário for Professor)
  DELETE FROM class_slots WHERE professor_id = p_user_id;

  -- 7. HISTÓRICO DE PACOTES
  DELETE FROM assigned_packages_log WHERE student_id = p_user_id;
  UPDATE assigned_packages_log SET professor_id = NULL WHERE professor_id = p_user_id;

  -- 8. TAREFAS
  BEGIN
    DELETE FROM student_tasks WHERE student_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 9. PERFIL E AUTH
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql;
