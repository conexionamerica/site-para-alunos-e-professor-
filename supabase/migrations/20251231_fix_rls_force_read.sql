-- Simplificação radical do RLS para a tabela profiles
-- Permite que qualquer usuário logado (autenticado) veja a lista de usuários.
-- Isso é necessário para que listas de seleção de usuários funcionem corretamente no frontend.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove policies restritivas anteriores para evitar conflitos
DROP POLICY IF EXISTS "Admins and Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON profiles;

-- Cria policy permissiva para leitura
CREATE POLICY "Enable read access for all authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Permissões de escrita continuam restritas (se houver policies de update/insert, elas são independentes do SELECT)
-- Exemplo: policy para update apenas pelo próprio usuário (mantendo segurança de dados)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);
