-- CORREÇÃO DE POLÍTICAS RLS PARA SOLICITAÇÕES DE AULA

-- 1. Habilitar RLS na tabela (garantia)
ALTER TABLE public.solicitudes_clase ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.solicitudes_clase;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.solicitudes_clase;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.solicitudes_clase;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.solicitudes_clase;
DROP POLICY IF EXISTS "Permitir inserção para alunos e admins" ON public.solicitudes_clase;

-- 3. Criar novas políticas abrangentes

-- INSERT: Permitir que qualquer usuário autenticado insira (necessário para Admin criar em nome de aluno)
-- Se quiser restringir, poderia checar se é admin ou se alumno_id = auth.uid()
CREATE POLICY "Permitir Insert Autenticado" 
ON public.solicitudes_clase 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- SELECT: Permitir ver solicitações onde o usuário é o aluno, o professor, ou é Admin
CREATE POLICY "Permitir Select Envolvidos e Admin" 
ON public.solicitudes_clase 
FOR SELECT 
USING (
    auth.uid() = alumno_id 
    OR auth.uid() = profesor_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);

-- UPDATE: Permitir update para os envolvidos e admin
CREATE POLICY "Permitir Update Envolvidos e Admin" 
ON public.solicitudes_clase 
FOR UPDATE 
USING (
    auth.uid() = alumno_id 
    OR auth.uid() = profesor_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);

-- DELETE: Permitir delete para admin ou o próprio criador (opcional)
CREATE POLICY "Permitir Delete Admin" 
ON public.solicitudes_clase 
FOR DELETE 
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);
