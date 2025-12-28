-- =====================================================
-- FASE 1: CÓDIGO DE ALUMNO + VINCULACIÓN A PROFESOR
-- =====================================================
-- Ejecutar este script completo en Supabase SQL Editor
-- Fecha: 2025-12-28
-- =====================================================

-- =====================================================
-- PASO 1: Agregar columna student_code
-- Formato: 0101010 (7 dígitos con ceros a la izquierda)
-- =====================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS student_code VARCHAR(7);

-- Crear índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_code 
ON profiles(student_code) 
WHERE student_code IS NOT NULL;

COMMENT ON COLUMN profiles.student_code IS 'Código único del alumno - formato 0000000 (7 dígitos)';

-- =====================================================
-- PASO 2: Agregar columna assigned_professor_id
-- Para vincular cada alumno a un profesor
-- =====================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS assigned_professor_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Crear índice para mejorar búsquedas por profesor
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_professor 
ON profiles(assigned_professor_id);

COMMENT ON COLUMN profiles.assigned_professor_id IS 'ID del profesor asignado al alumno (puede ser NULL)';

-- =====================================================
-- PASO 3: Crear función para generar código automático
-- =====================================================

CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS VARCHAR(7) AS $$
DECLARE
  last_code INTEGER;
  new_code INTEGER;
BEGIN
  -- Buscar el último código usado (o usar 0101009 si no hay ninguno)
  SELECT COALESCE(MAX(student_code::INTEGER), 0101009) INTO last_code
  FROM profiles
  WHERE student_code IS NOT NULL 
    AND student_code ~ '^[0-9]{7}$';
  
  -- Incrementar en 1
  new_code := last_code + 1;
  
  -- Retornar con formato de 7 dígitos
  RETURN LPAD(new_code::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASO 4: Crear trigger para auto-generar código
-- al crear un nuevo alumno
-- =====================================================

CREATE OR REPLACE FUNCTION set_student_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo asignar código si es un alumno y no tiene código
  IF NEW.role = 'student' AND (NEW.student_code IS NULL OR NEW.student_code = '') THEN
    NEW.student_code := generate_student_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe (para poder recrearlo)
DROP TRIGGER IF EXISTS trigger_set_student_code ON profiles;

-- Crear el trigger
CREATE TRIGGER trigger_set_student_code
BEFORE INSERT ON profiles
FOR EACH ROW 
EXECUTE FUNCTION set_student_code_on_insert();

-- =====================================================
-- PASO 5: Asignar códigos a alumnos existentes
-- Comenzando desde 0101010
-- =====================================================

-- Primero, ver cuántos alumnos hay sin código
DO $$
DECLARE
  student_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO student_count
  FROM profiles 
  WHERE role = 'student' AND (student_code IS NULL OR student_code = '');
  
  RAISE NOTICE 'Alumnos sin código: %', student_count;
END $$;

-- Asignar códigos secuenciales comenzando en 0101010
WITH numbered_students AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM profiles 
  WHERE role = 'student' 
    AND (student_code IS NULL OR student_code = '')
)
UPDATE profiles p
SET student_code = LPAD((0101010 + ns.rn - 1)::TEXT, 7, '0')
FROM numbered_students ns
WHERE p.id = ns.id;

-- =====================================================
-- PASO 6: Verificación
-- =====================================================

-- Verificar que las columnas fueron creadas
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('student_code', 'assigned_professor_id');

-- Verificar alumnos con sus códigos
SELECT 
  id,
  full_name,
  username,
  student_code,
  assigned_professor_id,
  created_at
FROM profiles 
WHERE role = 'student'
ORDER BY student_code ASC
LIMIT 20;

-- Resumen de códigos asignados
SELECT 
  'Total alumnos' as descripcion,
  COUNT(*) as cantidad
FROM profiles WHERE role = 'student'
UNION ALL
SELECT 
  'Con código asignado',
  COUNT(*) 
FROM profiles WHERE role = 'student' AND student_code IS NOT NULL
UNION ALL
SELECT 
  'Sin código',
  COUNT(*) 
FROM profiles WHERE role = 'student' AND student_code IS NULL;

-- =====================================================
-- FIN DE FASE 1 - SCRIPT SQL
-- =====================================================
