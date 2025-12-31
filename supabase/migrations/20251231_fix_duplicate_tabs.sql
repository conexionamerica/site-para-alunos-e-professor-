-- Fix duplicate tabs in role_settings
-- We will reset the tabs array to unique values for each role

-- Professor: Add 'servicos' cleanly
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{tabs}',
    '["inicio", "agenda", "conversas", "alunos", "aulas", "servicos"]'::jsonb
)
WHERE role = 'professor';

-- Superadmin: Add 'servicos' and 'financeiro' cleanly
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{tabs}',
    '["painel", "inicio", "agenda", "conversas", "alunos", "aulas", "admtab", "servicos", "financeiro"]'::jsonb
)
WHERE role = 'superadmin';

-- Student: Ensure clean state (no changes needed based on image, but safer to set explicitly)
UPDATE role_settings
SET permissions = jsonb_set(
    permissions,
    '{tabs}',
    '["dashboard", "clases", "chat", "desempenho", "faturas"]'::jsonb
)
WHERE role = 'student';

-- Verification query
SELECT role, permissions->'tabs' as tabs FROM role_settings;
