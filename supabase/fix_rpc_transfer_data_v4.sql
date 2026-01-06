-- FUNÇÃO RPC V4 (Transferência + Release Old + Block New)
-- Garante que ao transferir/desvincular, a agenda do professor anterior seja liberada.

DROP FUNCTION IF EXISTS transfer_student_data(uuid, uuid);

CREATE OR REPLACE FUNCTION transfer_student_data(
  p_student_id UUID,
  p_professor_id UUID -- Pode ser NULL (desvínculo)
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  v_old_professor_id UUID;
  v_released_slots_count INT := 0;
  v_blocked_slots_count INT := 0;
  v_appointments_count INT := 0;
  v_logs_count INT := 0;
BEGIN
  -- 1. Identificar Professor Anterior
  SELECT assigned_professor_id INTO v_old_professor_id
  FROM profiles
  WHERE id = p_student_id;

  -- 2. LIBERAR SLOTS DO ANTERIOR (Se existir)
  IF v_old_professor_id IS NOT NULL THEN
    WITH student_classes_old AS (
      SELECT class_datetime 
      FROM appointments 
      WHERE student_id = p_student_id 
        AND status IN ('scheduled', 'pending', 'confirmed') -- Aulas futuras ou pendentes
        AND professor_id = v_old_professor_id -- Importante: apenas as que estavam com ele
    ),
    slots_to_release AS (
      SELECT cs.id
      FROM class_slots cs
      JOIN student_classes_old sc 
        -- Extrai DOW (Domingo=0) corrigido para SP
        ON cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
        -- Extrai Hora corrigida para SP
        AND cs.start_time = (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')::time
      WHERE cs.professor_id = v_old_professor_id
        AND cs.status = 'filled' -- Apenas se estiver ocupado
    ),
    released_rows AS (
      UPDATE class_slots
      SET status = 'active'
      WHERE id IN (SELECT id FROM slots_to_release)
      RETURNING 1
    )
    SELECT count(*) INTO v_released_slots_count FROM released_rows;
  END IF;

  -- 3. TRANSFERIR AULAS E HISTÓRICO
  WITH updated_rows AS (
    UPDATE appointments
    SET professor_id = p_professor_id
    WHERE student_id = p_student_id
      AND status IN ('scheduled', 'pending')
    RETURNING 1
  )
  SELECT count(*) INTO v_appointments_count FROM updated_rows;

  -- Remove do antigo e põe no novo (logs)
  UPDATE assigned_packages_log
  SET professor_id = p_professor_id
  WHERE student_id = p_student_id
    AND (professor_id IS NULL OR professor_id = v_old_professor_id);
  GET DIAGNOSTICS v_logs_count = ROW_COUNT;

  -- 4. ATUALIZAR PERFIL (Vínculo)
  UPDATE profiles
  SET assigned_professor_id = p_professor_id,
      pending_professor_id = NULL,
      pending_professor_status = NULL,
      pending_professor_requested_at = NULL
  WHERE id = p_student_id;

  -- 5. BLOQUEAR SLOTS DO NOVO PROFESSOR (Se houver novo)
  IF p_professor_id IS NOT NULL THEN
     WITH student_classes_new AS (
      SELECT class_datetime 
      FROM appointments 
      WHERE student_id = p_student_id 
        AND status IN ('scheduled', 'pending')
    ),
    slots_to_block AS (
      SELECT cs.id
      FROM class_slots cs
      JOIN student_classes_new sc 
        ON cs.day_of_week = CAST(EXTRACT(DOW FROM (sc.class_datetime AT TIME ZONE 'America/Sao_Paulo')) AS INTEGER)
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
  END IF;

  RETURN json_build_object(
    'appointments', v_appointments_count,
    'logs', v_logs_count,
    'released_slots', v_released_slots_count,
    'blocked_slots', v_blocked_slots_count
  );
END;
$$ LANGUAGE plpgsql;
