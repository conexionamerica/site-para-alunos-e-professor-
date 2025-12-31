-- DIAGNÓSTICO: Verificar professores cadastrados
-- Execute esta query no Supabase SQL Editor

-- 1. Ver TODOS os usuários e suas roles
SELECT 
    id,
    full_name,
    email,
    role,
    created_at
FROM profiles
ORDER BY role, full_name;

-- 2. Contar por role
SELECT 
    role,
    COUNT(*) as total
FROM profiles
GROUP BY role
ORDER BY role;

-- 3. Ver apenas professores
SELECT 
    id,
    full_name,
    email,
    role,
    created_at
FROM profiles
WHERE role = 'professor'
ORDER BY full_name;

-- 4. Ver se há variações de case
SELECT 
    id,
    full_name,
    email,
    role,
    LOWER(role) as role_lowercase
FROM profiles
WHERE LOWER(role) LIKE '%professor%'
ORDER BY full_name;
