-- Script de Migração: Configurar permissões de abas para cada perfil
-- Execute este SQL no Supabase SQL Editor

-- Limpar configurações existentes (opcional - comente se quiser manter as existentes)
-- DELETE FROM role_settings;

-- Inserir configurações para perfil de Aluno (student)
INSERT INTO role_settings (role, permissions, updated_at)
VALUES (
    'student',
    '{"tabs": ["dashboard", "clases", "chat", "desempenho", "faturas"]}'::jsonb,
    NOW()
)
ON CONFLICT (role) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Inserir configurações para perfil de Professor (professor)
INSERT INTO role_settings (role, permissions, updated_at)
VALUES (
    'professor',
    '{"tabs": ["inicio", "agenda", "conversas", "alunos", "aulas", "preferencias"]}'::jsonb,
    NOW()
)
ON CONFLICT (role) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Inserir configurações para perfil de Administrador (superadmin)
-- Nota: Superadmins sempre têm acesso total, mas registramos explicitamente
INSERT INTO role_settings (role, permissions, updated_at)
VALUES (
    'superadmin',
    '{"tabs": ["painel", "inicio", "agenda", "conversas", "alunos", "aulas", "admtab"]}'::jsonb,
    NOW()
)
ON CONFLICT (role) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- Verificar as configurações inseridas
SELECT * FROM role_settings ORDER BY role;
