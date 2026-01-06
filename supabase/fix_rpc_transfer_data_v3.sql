-- FUNÇÃO RPC V3 (Transferência + Bloqueio de Slots)
-- CORREÇÃO: Adicionado DROP FUNCTION para permitir mudança de tipo de retorno (void -> json)

DROP FUNCTION IF EXISTS transfer_student_data(uuid, uuid);

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
  v_blocked_slots_count INT;
BEGIN
  -- 1. Transferir Aulas
  WITH updated_rows AS (
    UPDATE appointments
    SET professor_id = p_professor_id
    WHERE student_id = p_student_id
      AND professor_id IS NULL
      AND (status = 'scheduled' OR status = 'pending')
    RETURNING 1
  )
  SELECT count(*) INTO v_appointments_count FROM updated_rows;

  -- 2. Transferir Logs
  WITH updated_logs AS (
    UPDATE assigned_packages_log
    SET professor_id = p_professor_id
    WHERE student_id = p_student_id
      AND professor_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_logs_count FROM updated_logs;

  -- 3. Atualizar Vínculo no Perfil
  UPDATE profiles
  SET assigned_professor_id = p_professor_id,
      pending_professor_id = NULL,
      pending_professor_status = NULL,
      pending_professor_requested_at = NULL
  WHERE id = p_student_id;

  -- 4. BLOQUEAR SLOTS NA AGENDA DO PROFESSOR
  -- Usa horário de SP para garantir match correto com os slots definidos
  WITH student_classes AS (
      SELECT class_datetime 
      FROM appointments 
      WHERE student_id = p_student_id 
        AND status IN ('scheduled', 'pending')
  ),
  slots_to_block AS (
      SELECT cs.id
      FROM class_slots cs
      JOIN student_classes sc 
        ON cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
        AND cs.start_time = (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')::time
      WHERE cs.professor_id = p_professor_id
        AND cs.status = 'active'
  ),
  blocked_rows AS (
      UPDATE class_slots
      SET status = 'filled'
      WHERE id IN (SELECT id FROM slots_to_block)
      RETURNING 1
  )
  SELECT count(*) INTO v_blocked_slots_count FROM blocked_rows;

  RETURN json_build_object(
    'appointments', COALESCE(v_appointments_count, 0), 
    'logs', COALESCE(v_logs_count, 0), 
    'blocked_slots', COALESCE(v_blocked_slots_count, 0)
  );
END;
$$ LANGUAGE plpgsql;
