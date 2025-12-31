-- Migration: Add Serviços and Financeiro tabs to role permissions
-- Description: Updates role_settings to include new tabs in permissions

-- Update role_settings to add new tabs
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{tabs}',
    permissions->'tabs' || '["servicos", "financeiro"]'::jsonb
)
WHERE role = 'superadmin';

-- For professors, add only Serviços by default (Financeiro can be enabled per role)
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{tabs}',
    permissions->'tabs' || '["servicos"]'::jsonb
)
WHERE role = 'professor';

-- Don't add to students by default
-- Admins can enable these tabs per role as needed

-- Verification
SELECT role, permissions->'tabs' as tabs 
FROM role_settings 
ORDER BY role;

COMMENT ON TABLE role_settings IS 'Role-based permissions including tabs access: alunos, aulas, admin, servicos, financeiro';
