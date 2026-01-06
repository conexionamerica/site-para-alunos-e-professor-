-- RPC PARA EXCLUSÃO TOTAL (V2 - COM CHAT E NOTIFICAÇÕES)
CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- 1. Identificar role (opcional, para logs ou lógica específica)
  -- SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

  -- 2. CHAT E MENSAGENS (Importante limpar antes de apagar chats)
  -- Remove mensagens enviadas pelo usuário
  DELETE FROM mensajes WHERE remitente_id = p_user_id;
  
  -- Remove mensagens dos chats onde o usuário é dono (aluno ou professor)
  DELETE FROM mensajes 
  WHERE chat_id IN (SELECT chat_id FROM chats WHERE alumno_id = p_user_id OR profesor_id = p_user_id);

  -- Remove os chats do usuário
  DELETE FROM chats WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 3. NOTIFICAÇÕES
  BEGIN
    DELETE FROM notifications WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 4. AULAS (Appointments)
  DELETE FROM appointments WHERE student_id = p_user_id OR professor_id = p_user_id;

  -- 5. SOLICITAÇÕES
  DELETE FROM solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 6. FINANCEIRO (Faturas/Títulos)
  BEGIN
    DELETE FROM financial_titles WHERE student_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
  
  BEGIN
    DELETE FROM invoices WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;
  
  -- 7. SLOTS (Professor)
  DELETE FROM class_slots WHERE professor_id = p_user_id;

  -- 8. HISTÓRICO DE PACOTES (Logs)
  DELETE FROM assigned_packages_log WHERE student_id = p_user_id;
  UPDATE assigned_packages_log SET professor_id = NULL WHERE professor_id = p_user_id;

  -- 9. TAREFAS
  BEGIN
    DELETE FROM student_tasks WHERE student_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 10. PERFIL E AUTH
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql;
