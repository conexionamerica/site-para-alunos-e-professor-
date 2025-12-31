-- Migração: Adicionar permissões de ações aos role_settings
-- Data: 2025-12-30
-- Objetivo: Expandir a estrutura de permissions para incluir permissões granulares de ações

-- Atualizar role_settings para incluir permissões de ações
-- A estrutura será expandida de {"tabs": [...]} para {"tabs": [...], "actions": {...}}

-- Atualizar perfil de Aluno (student)
-- Alunos normalmente não gerenciam aulas ou outros alunos
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{actions}',
    '{"can_manage_classes": false, "can_manage_students": false}'::jsonb
),
updated_at = NOW()
WHERE role = 'student';

-- Atualizar perfil de Professor (professor)
-- Professores podem gerenciar suas próprias aulas e alunos
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{actions}',
    '{"can_manage_classes": true, "can_manage_students": true}'::jsonb
),
updated_at = NOW()
WHERE role = 'professor';

-- Atualizar perfil de Superadmin (superadmin)
-- Superadmins têm acesso total
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{actions}',
    '{"can_manage_classes": true, "can_manage_students": true}'::jsonb
),
updated_at = NOW()
WHERE role = 'superadmin';

-- Verificar as configurações atualizadas
SELECT role, permissions FROM role_settings ORDER BY role;
