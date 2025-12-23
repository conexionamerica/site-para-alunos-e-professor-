-- Script de Verificación Post-Migración
-- Ejecutar este script después de aplicar add_real_email_column.sql

-- 1. Verificar que la columna real_email existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'real_email';

-- 2. Verificar que el índice fue creado
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles' AND indexname = 'idx_profiles_real_email';

-- 3. Verificar que todos los perfiles tienen real_email
SELECT 
    COUNT(*) as total_profiles,
    COUNT(real_email) as profiles_with_real_email,
    COUNT(*) - COUNT(real_email) as profiles_without_real_email
FROM profiles;

-- 4. Mostrar algunos ejemplos de perfiles
SELECT id, email, real_email, full_name, username, role, is_active
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar el trigger handle_new_user
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc
WHERE proname = 'handle_new_user';

-- 6. Verificar que el trigger está activo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 7. Buscar perfiles duplicados por real_email (debería haber algunos si ya se registraron)
SELECT 
    real_email,
    COUNT(*) as count,
    STRING_AGG(full_name, ', ') as names
FROM profiles
WHERE real_email IS NOT NULL
GROUP BY real_email
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 8. Verificar que no hay real_email NULL (todos deberían tener valor)
SELECT COUNT(*) as profiles_with_null_real_email
FROM profiles
WHERE real_email IS NULL;

-- Si el resultado anterior es > 0, ejecutar:
-- UPDATE profiles SET real_email = email WHERE real_email IS NULL;
