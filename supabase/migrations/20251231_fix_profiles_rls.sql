-- Função segura para verificar se usuário é admin (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar Policies da tabela Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas conflitantes (se existirem)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON profiles;

-- Policy: Admin/Superadmin pode ver todos os perfis
CREATE POLICY "Admins and Superadmins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (public.is_admin_or_superadmin());

-- Policy: Usuários podem ver seu próprio perfil (já deve existir, mas garantindo)
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
CREATE POLICY "Users can see own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy: Professores podem ver perfis de alunos (opcional, dependendo da regra de negócio)
-- Mas para o dropdown funcionar para o admin, a policy acima resolve.
