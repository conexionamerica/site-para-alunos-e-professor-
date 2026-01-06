-- FUNÇÃO RPC PARA TRANSFERÊNCIA SEGURA DE DADOS DO ALUNO
-- Substitui a lógica de update manual no frontend que falha por RLS.

CREATE OR REPLACE FUNCTION transfer_student_data(
  p_student_id UUID,
  p_professor_id UUID
)
RETURNS void
SECURITY DEFINER -- Roda com permissões de Admin/Superuser
AS $$
BEGIN
  -- 1. Transferir Appointments (Aulas)
  -- Pega todas as aulas agendadas (scheduled) que estão sem professor (NULL)
  -- e transfere para o professor aceito.
  UPDATE appointments
  SET professor_id = p_professor_id
  WHERE student_id = p_student_id
    AND professor_id IS NULL
    AND status = 'scheduled'; 
    -- Se quiser incluir 'pending', adicione: OR status = 'pending'

  -- 2. Transferir Logs de Pacotes
  UPDATE assigned_packages_log
  SET professor_id = p_professor_id
  WHERE student_id = p_student_id
    AND professor_id IS NULL;

  -- 3. Atualizar Profile (Garantir Vínculo e Limpar Pendências)
  UPDATE profiles
  SET assigned_professor_id = p_professor_id,
      pending_professor_id = NULL,
      pending_professor_status = NULL,
      pending_professor_requested_at = NULL
  WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql;
