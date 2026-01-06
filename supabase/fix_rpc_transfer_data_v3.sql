-- FUNÇÃO RPC V3 (Transferência + Bloqueio de Slots)
-- Além de transferir aulas e logs, busca e bloqueia (status='filled') os slots correspondentes na agenda do professor.

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
  -- 1. appointments (Transferir aulas)
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

  -- 4. BLOQUEIO DE AGENDA (class_slots)
  -- Busca aulas do aluno (agora já transferidas ou não) e marca slots do professor como 'filled'
  -- ATENÇÃO: Converte para horário de São Paulo para bater com os slots definidos localmente (ex: 08:00)
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
        -- Extrai dia da semana (0-6) corrigido para SP
        ON cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
        -- Extrai hora (HH:MM:00) corrigida para SP e compara com start_time
        AND cs.start_time = (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')::time
      WHERE cs.professor_id = p_professor_id
        AND cs.status = 'active' -- Só bloqueia se estiver livre
  ),
  blocked_rows AS (
      UPDATE class_slots
      SET status = 'filled'
      WHERE id IN (SELECT id FROM slots_to_block)
      RETURNING 1
  )
  SELECT count(*) INTO v_blocked_slots_count FROM blocked_rows;

  -- Retorna resumo completo
  RETURN json_build_object(
    'appointments', COALESCE(v_appointments_count, 0),
    'logs', COALESCE(v_logs_count, 0),
    'blocked_slots', COALESCE(v_blocked_slots_count, 0)
  );
END;
$$ LANGUAGE plpgsql;
