-- =====================================================
-- FASE 2: CREAR SUPERUSUARIO
-- =====================================================
-- Ejecutar este script en Supabase SQL Editor
-- Fecha: 2025-12-28
-- =====================================================

-- =====================================================
-- INSTRUCCIONES PREVIAS (hacer en Supabase Dashboard):
-- =====================================================
-- 1. Ve a Authentication > Users en Supabase Dashboard
-- 2. Click "Add User" > "Create New User"
-- 3. Email: emaildeconexionamerica@gmail.com
-- 4. Password: AlyRoberto2025*
-- 5. Marca "Auto Confirm User" = ON
-- 6. Click "Create User"
-- 7. ¡LISTO! Luego ejecuta este script SQL
-- =====================================================

-- PASO 1: Crear o actualizar el perfil del superusuario
-- Este script encuentra automáticamente el usuario por email y asigna rol superadmin

INSERT INTO profiles (id, username, full_name, role, is_active)
SELECT 
  id,
  'superadmin',
  'Administrador',
  'superadmin',
  true
FROM auth.users 
WHERE email = 'emaildeconexionamerica@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'superadmin',
  full_name = COALESCE(EXCLUDED.full_name, 'Administrador'),
  is_active = true;

-- =====================================================
-- PASO 2: Verificación
-- =====================================================

-- Verificar que el superusuario fue creado
SELECT 
  p.id,
  p.username,
  p.full_name,
  p.role,
  p.is_active,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'superadmin';

-- Resumen de usuarios por rol
SELECT 
  role,
  COUNT(*) as cantidad
FROM profiles
GROUP BY role
ORDER BY role;

-- =====================================================
-- FIN - El superusuario está listo
-- =====================================================
