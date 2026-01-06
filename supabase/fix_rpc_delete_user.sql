-- RPC PARA EXCLUSÃO TOTAL DE USUÁRIO (FORCE DELETE)
-- Remove todos os vínculos (aulas, solicitações, financeiro) antes de apagar o usuário.

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. AULAS (Appointments) - Tanto como aluno quanto professor
  DELETE FROM appointments WHERE student_id = p_user_id OR professor_id = p_user_id;

  -- 2. SOLICITAÇÕES (Solicitudes)
  DELETE FROM solicitudes_clase WHERE alumno_id = p_user_id OR profesor_id = p_user_id;

  -- 3. SLOTS DA AGENDA (Se for professor)
  DELETE FROM class_slots WHERE professor_id = p_user_id;

  -- 4. HISTÓRICO DE PACOTES (Logs)
  -- Se for aluno, deleta o histórico de compras/atribuições
  DELETE FROM assigned_packages_log WHERE student_id = p_user_id;
  -- Se for professor, desvincula do histórico dos alunos (mantém o log, mas sem professor)
  UPDATE assigned_packages_log SET professor_id = NULL WHERE professor_id = p_user_id;

  -- 5. TAREFAS (Se existirem tabelas relacionadas)
  BEGIN
    DELETE FROM student_tasks WHERE student_id = p_user_id;
  EXCEPTION WHEN undefined_table THEN NULL; END;
  
  BEGIN
    DELETE FROM tasks WHERE created_by = p_user_id; -- Exemplo genérico
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

  -- 6. FINANCEIRO (Faturas/Títulos)
  BEGIN
    DELETE FROM financial_titles WHERE student_id = p_user_id; -- Se houver tabela financeira
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

  BEGIN
    DELETE FROM invoices WHERE user_id = p_user_id; -- Outro nome comum
  EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END;

  -- 7. PERFIL (Profiles)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 8. USUÁRIO DE AUTENTICAÇÃO (Auth.users)
  -- Requer privilégios de superuser ou role postgres. 
  -- Como a função é SECURITY DEFINER, ela roda com permissão de quem criou (geralmente postgres).
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql;
