-- CORREÇÃO RLS PARA PROFILES (Aprovação de Alunos)

-- O problema: O professor tenta aprovar o aluno, o que exige atualizar a tabela 'profiles' para definir 'assigned_professor_id'.
-- Por padrão, usuários só podem editar seu próprio perfil e Admin. Precisamos permitir que professores editem seus alunos pendentes.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Permitir que o professor pendente "Se aceite"
-- Permite UPDATE se você for o professor pendente
DROP POLICY IF EXISTS "Professor pode aceitar vinculo" ON public.profiles;

CREATE POLICY "Professor pode aceitar vinculo"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  pending_professor_id = auth.uid() OR
  assigned_professor_id = auth.uid() -- Para editar depois se precisar
  OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
)
WITH CHECK (
  -- O professor só pode alterar para definir a si mesmo (assigned) ou limpar (rejeitar)
  assigned_professor_id = auth.uid() OR 
  auth.uid() = pending_professor_id -- Mantém condição de autoridade
  OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);

-- Garantir Select amplo para que professores vejam alunos pendentes
DROP POLICY IF EXISTS "Ver perfis publicos" ON public.profiles;
CREATE POLICY "Ver perfis publicos"
ON public.profiles
FOR SELECT
USING (true);
