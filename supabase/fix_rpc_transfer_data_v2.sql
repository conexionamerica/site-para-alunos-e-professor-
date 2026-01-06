-- FUNÇÃO RPC MELHORADA (Com Retorno de Contadores)
-- Retorna JSON com número de linhas afetadas para feedback visual.

CREATE OR REPLACE FUNCTION transfer_student_data(
  p_student_id UUID,
  p_professor_id UUID
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  v_appointments_count INT;
  v_logs_count INT;
BEGIN
  -- 1. appointments (Transferir aulas sem professor)
  WITH updated_rows AS (
    UPDATE appointments
    SET professor_id = p_professor_id
    WHERE student_id = p_student_id
      AND professor_id IS NULL
      AND (status = 'scheduled' OR status = 'pending')
    RETURNING 1
  )
  SELECT count(*) INTO v_appointments_count FROM updated_rows;

  -- 2. logs (Transferir histórico)
  WITH updated_logs AS (
    UPDATE assigned_packages_log
    SET professor_id = p_professor_id
    WHERE student_id = p_student_id
      AND professor_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_logs_count FROM updated_logs;

  -- 3. profiles (Vínculo)
  UPDATE profiles
  SET assigned_professor_id = p_professor_id,
      pending_professor_id = NULL,
      pending_professor_status = NULL,
      pending_professor_requested_at = NULL
  WHERE id = p_student_id;

  -- Retorna resumo
  RETURN json_build_object(
    'appointments', COALESCE(v_appointments_count, 0),
    'logs', COALESCE(v_logs_count, 0)
  );
END;
$$ LANGUAGE plpgsql;
