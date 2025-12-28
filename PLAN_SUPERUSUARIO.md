# 🔐 Plan de Implementación: Sistema de Superusuario y Perfiles de Acceso

## 📋 Resumen de Requisitos

### 1. Código único numérico para alumnos
- Formato: `0000000` (7 dígitos)
- Inicio: `0101010`
- Auto-generado al crear usuario
- Asignar a alumnos existentes

### 2. Vincular alumnos a profesores  
- Nueva columna `professor_id` en tabla `profiles`
- Puede estar en blanco

### 3. Nuevo rol de Superusuario
- Login: `emaildeconexionamerica@gmail.com`
- Senha: `AlyRoberto2025*`
- Acceso por portal del profesor

### 4. Funcionalidades del Superusuario

| Tab | Funcionalidad |
|-----|---------------|
| **Início** | Ver TODAS las solicitudes de aulas y próximas aulas con nombre del profesor |
| **Agenda** | Ver TODAS las aulas + filtro de profesor |
| **Alunos** | Ver TODOS los alumnos con columna profesor + filtro |
| **Aulas** | Ver TODAS las aulas + filtro de profesor |
| **Administração** (submenu) | Preferências (de todos los profesores con filtro), Usuários, Perfis de Acesso |

---

## 🏗️ Arquitectura de Implementación

### Fase 1: Cambios en Base de Datos (Supabase)

```sql
-- 1. Agregar columna student_code para código único de alumno
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS student_code VARCHAR(7);

-- 2. Agregar columna professor_id para vincular alumno a profesor
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS assigned_professor_id UUID REFERENCES profiles(id);

-- 3. Agregar columna role con soporte para 'superadmin'
-- (ya existe 'role', solo agregar nuevo valor posible)

-- 4. Crear función para generar código automático
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS VARCHAR AS $$
DECLARE
  last_code INTEGER;
  new_code INTEGER;
BEGIN
  SELECT COALESCE(MAX(student_code::INTEGER), 101009) INTO last_code
  FROM profiles
  WHERE student_code IS NOT NULL AND student_code ~ '^[0-9]+$';
  
  new_code := last_code + 1;
  RETURN LPAD(new_code::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para auto-generar código al crear alumno
CREATE OR REPLACE FUNCTION set_student_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.student_code IS NULL THEN
    NEW.student_code := generate_student_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_student_code
BEFORE INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION set_student_code();

-- 6. Asignar códigos a alumnos existentes (comenzando en 0101010)
UPDATE profiles 
SET student_code = LPAD((0101010 + ROW_NUMBER() OVER (ORDER BY created_at))::TEXT, 7, '0')
WHERE role = 'student' AND student_code IS NULL;

-- 7. Crear usuario superadmin
-- (Se crea via auth.users + profiles)
```

### Fase 2: Cambios en el Frontend

#### 2.1 Modificar `SupabaseAuthContext.jsx`
- Detectar rol `superadmin` además de `professor`
- Permitir acceso al portal del profesor para superadmins

#### 2.2 Modificar `ProfessorLoginPage.jsx`
- Permitir login de usuarios con rol `superadmin`
- Redirigir a dashboard apropiado

#### 2.3 Crear/Modificar `ProfessorDashboardPage.jsx`
- Detectar si el usuario es `superadmin`
- Mostrar tabs diferentes según rol:
  - **Professor**: Tabs actuales
  - **Superadmin**: Tabs con vista global + Administração

#### 2.4 Crear nuevos componentes para Superadmin

| Componente | Descripción |
|------------|-------------|
| `SuperadminHomeTab.jsx` | Inicio con todas las solicitudes y aulas |
| `SuperadminAgendaTab.jsx` | Agenda global con filtro de profesor |
| `SuperadminAlunosTab.jsx` | Alumnos con columna y filtro professor |
| `SuperadminAulasTab.jsx` | Aulas globales con filtro profesor |
| `AdminTab.jsx` | Menú Administração con submenus |
| `AdminPreferenciasTab.jsx` | Preferencias de todos los profesores |
| `AdminUsuariosTab.jsx` | CRUD de usuarios |
| `AdminPerfisTab.jsx` | Gestión de perfiles de acceso |

### Fase 3: Gestión de Perfiles de Acceso

#### Nueva tabla `access_profiles`
```sql
CREATE TABLE access_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Permisos por defecto
INSERT INTO access_profiles (name, description, permissions) VALUES
('student', 'Acesso de aluno', '{"tabs": ["home", "aulas", "chat"]}'),
('professor', 'Acesso de professor', '{"tabs": ["home", "agenda", "conversas", "alunos", "aulas", "preferencias"]}'),
('superadmin', 'Acesso completo', '{"tabs": ["home", "agenda", "conversas", "alunos", "aulas", "administracao"], "is_global": true}');
```

---

## 📝 Orden de Implementación

1. ✅ **Crear migración SQL** para cambios en base de datos
2. ✅ **Crear usuario superadmin** en Supabase
3. ✅ **Modificar autenticación** para soportar superadmin
4. ✅ **Modificar dashboard** para detectar rol
5. ✅ **Crear componentes** de superadmin
6. ✅ **Implementar filtros** de profesor en cada tab
7. ✅ **Crear menú Administração** con submenus
8. ✅ **Testing** completo
9. ✅ **Deploy**

---

## ⚠️ Consideraciones Importantes

1. **Seguridad**: El superadmin tiene acceso total. Debe protegerse bien.
2. **RLS (Row Level Security)**: Actualizar políticas para superadmin.
3. **Performance**: Queries globales pueden ser lentas. Usar paginación.
4. **Backward Compatibility**: Mantener funcionalidad actual para profesores.

---

## 🚀 ¿Listo para comenzar?

Este plan requiere aproximadamente:
- **Cambios en DB**: ~5 scripts SQL
- **Archivos nuevos**: ~6 componentes
- **Archivos modificados**: ~4-5 archivos existentes
- **Tiempo estimado**: 2-4 horas de implementación

**¿Desea que proceda con la implementación?**
