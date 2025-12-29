-- Migração para criação da tabela de configurações de permissões por papel
CREATE TABLE IF NOT EXISTS public.role_settings (
    role TEXT PRIMARY KEY,
    permissions JSONB NOT NULL DEFAULT '{"tabs": []}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.role_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para usuários autenticados" ON public.role_settings
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas superadmins podem editar configurações" ON public.role_settings
FOR ALL TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- Inserir valores padrão
INSERT INTO public.role_settings (role, permissions)
VALUES 
    ('student', '{"tabs": ["dashboard", "clases", "chat", "desempenho", "faturas"]}'),
    ('professor', '{"tabs": ["inicio", "agenda", "alunos", "aulas", "conversas", "preferencias"]}'),
    ('superadmin', '{"tabs": ["inicio", "agenda", "alunos", "aulas", "conversas", "preferencias", "admtab", "global"]}')
ON CONFLICT (role) DO UPDATE SET permissions = EXCLUDED.permissions;
