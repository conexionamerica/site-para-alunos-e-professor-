-- CORREÇÃO: PERMITIR QUE PROFESSOR ASSUMA AULAS "SEM PROFESSOR"
-- O problema atual é que o professor tenta transferir as aulas (que estão como NULL) para ele,
-- mas a regra de segurança impede que ele altere aulas que não são dele.

-- 1. APPOINTMENTS (Aulas)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Remove política antiga se existir (para evitar duplicidade/conflito)
DROP POLICY IF EXISTS "Professores podem assumir aulas livres" ON public.appointments;

-- Cria política permitindo UPDATE em linhas onde professor_id é NULL
CREATE POLICY "Professores podem assumir aulas livres"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  professor_id IS NULL OR professor_id = auth.uid()
)
WITH CHECK (
  professor_id = auth.uid()
);


-- 2. ASSIGNED_PACKAGES_LOG (Histórico de Pacotes)
ALTER TABLE public.assigned_packages_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professores podem assumir logs livres" ON public.assigned_packages_log;

CREATE POLICY "Professores podem assumir logs livres"
ON public.assigned_packages_log
FOR UPDATE
TO authenticated
USING (
  professor_id IS NULL OR professor_id = auth.uid()
)
WITH CHECK (
  professor_id = auth.uid()
);

-- 3. PROFILES (Garantir que professor possa atualizar o perfil do aluno para se vincular)
-- Geralmente isso já é permitido se for 'vinculacao', mas vamos garantir
-- (O update do perfil geralmente é: assigned_professor_id = novo_prof)
-- Se tiver política restritiva no profiles, pode falhar também.
-- Mas o erro relatado foi "não atribuiu aulas", o vínculo parece ter rolado.
