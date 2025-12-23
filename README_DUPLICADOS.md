# 🎓 Sistema de Alumnos Duplicados - LUNO Conexión América

## 📌 Descripción General

Este proyecto implementa una solución que permite registrar múltiples alumnos con el mismo nombre, correo electrónico y nombre de usuario en el sitio **LUNO.CONEXIONAMERICA.com.br**.

## 🎯 Objetivo

Permitir que el sistema de gestión de alumnos acepte registros duplicados sin restricciones de unicidad en:
- ✅ Nombre completo
- ✅ Correo electrónico
- ✅ Nombre de usuario

## 🔧 Solución Técnica

### Arquitectura

El sistema utiliza una estrategia de **emails internos únicos** para cumplir con las restricciones de Supabase Auth, mientras mantiene la flexibilidad de permitir duplicados desde la perspectiva del usuario.

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUJO DE REGISTRO                         │
└─────────────────────────────────────────────────────────────┘

Usuario ingresa:
  Email: test@example.com
  Nombre: Juan Pérez
  Usuario: juanperez
  
         ↓
         
Sistema genera internamente:
  Email Auth: student_1703012345_abc123@internal.conexionamerica.com.br
  Metadata: { real_email: "test@example.com" }
  
         ↓
         
Base de Datos guarda:
  profiles.email: student_1703012345_abc123@internal.conexionamerica.com.br
  profiles.real_email: test@example.com
  profiles.full_name: Juan Pérez
  profiles.username: juanperez
```

### Componentes Modificados

1. **SupabaseAuthContext.jsx**
   - `signUp()`: Genera emails internos únicos
   - `signIn()`: Busca por email real antes de autenticar
   - `sendPasswordResetLink()`: Busca email interno basado en email real

2. **AdmTab.jsx**
   - Muestra `real_email` en lugar de email interno

3. **Base de Datos**
   - Nueva columna: `profiles.real_email`
   - Nuevo índice: `idx_profiles_real_email`
   - Trigger actualizado: `handle_new_user()`

## 📁 Estructura de Archivos

```
site-para-alunos-e-professor-/
├── src/
│   ├── contexts/
│   │   └── SupabaseAuthContext.jsx          ✏️ Modificado
│   └── components/
│       └── professor-dashboard/
│           └── AdmTab.jsx                    ✏️ Modificado
├── supabase/
│   └── migrations/
│       ├── add_real_email_column.sql         ✨ Nuevo
│       └── verify_real_email_migration.sql   ✨ Nuevo
├── INSTRUCCIONES_ALUMNOS_DUPLICADOS.md       ✨ Nuevo
├── RESUMEN_CAMBIOS.md                        ✨ Nuevo
├── GUIA_PRUEBAS_DUPLICADOS.md                ✨ Nuevo
└── README_DUPLICADOS.md                      ✨ Nuevo (este archivo)
```

## 🚀 Instalación y Configuración

### Paso 1: Ejecutar la Migración SQL

1. Acceder a Supabase Dashboard: https://supabase.com/dashboard
2. Ir a **SQL Editor**
3. Copiar el contenido de `supabase/migrations/add_real_email_column.sql`
4. Ejecutar la query

### Paso 2: Verificar la Migración

Ejecutar el script de verificación:
```sql
-- Copiar y ejecutar: supabase/migrations/verify_real_email_migration.sql
```

### Paso 3: Reiniciar la Aplicación

```bash
cd site-para-alunos-e-professor-
npm run dev
```

## 🧪 Pruebas

Seguir la guía completa de pruebas en: `GUIA_PRUEBAS_DUPLICADOS.md`

### Prueba Rápida

1. Registrar alumno 1:
   - Email: `test@example.com`
   - Contraseña: `Pass123!`

2. Registrar alumno 2:
   - Email: `test@example.com` (mismo)
   - Contraseña: `Pass456!`

3. ✅ Ambos registros deben ser exitosos

## 📊 Características

### ✅ Funcionalidades Implementadas

- [x] Registro de alumnos con emails duplicados
- [x] Registro de alumnos con nombres duplicados
- [x] Registro de alumnos con usernames duplicados
- [x] Login con email real (no interno)
- [x] Recuperación de contraseña con email real
- [x] Visualización de email real en interfaces
- [x] Compatibilidad con usuarios existentes
- [x] Migración automática de datos existentes

### 🔒 Seguridad

- ✅ Emails internos únicos garantizados por timestamp + random
- ✅ Autenticación segura mediante Supabase Auth
- ✅ Contraseñas hasheadas individualmente
- ✅ Sesiones independientes por usuario

## 📖 Documentación

### Documentos Disponibles

1. **INSTRUCCIONES_ALUMNOS_DUPLICADOS.md**
   - Instrucciones paso a paso para implementar
   - Solución de problemas comunes

2. **RESUMEN_CAMBIOS.md**
   - Resumen técnico de todos los cambios
   - Lista de archivos modificados

3. **GUIA_PRUEBAS_DUPLICADOS.md**
   - Escenarios de prueba detallados
   - Checklist de verificación

4. **README_DUPLICADOS.md** (este archivo)
   - Visión general del proyecto
   - Guía de inicio rápido

## 🔍 Detalles Técnicos

### Formato de Email Interno

```
student_[timestamp]_[random]@internal.conexionamerica.com.br
```

Ejemplo:
```
student_1703012345_abc123@internal.conexionamerica.com.br
```

### Estructura de Datos

**Tabla: profiles**
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,              -- Email interno único
  real_email TEXT,                -- Email real del usuario (puede duplicarse)
  full_name TEXT,                 -- Puede duplicarse
  username TEXT,                  -- Puede duplicarse
  role TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_real_email ON profiles(real_email);
```

## ⚠️ Consideraciones Importantes

### Limitaciones

1. **Recuperación de Contraseña**: Si hay múltiples usuarios con el mismo email real, el link se enviará al primero registrado.

2. **Búsqueda de Usuarios**: El profesor verá múltiples usuarios con el mismo email en la lista.

3. **Notificaciones por Email**: Las notificaciones se enviarán al email real, por lo que múltiples usuarios podrían recibir notificaciones en el mismo buzón.

### Recomendaciones

1. **Distinguir Usuarios**: Considerar agregar un campo adicional (ej: número de identificación) para distinguir usuarios con el mismo email.

2. **Interfaz de Búsqueda**: Mejorar la interfaz de búsqueda para mostrar información adicional cuando hay duplicados.

3. **Documentación para Usuarios**: Informar a los usuarios finales sobre esta funcionalidad.

## 🐛 Solución de Problemas

### Error: "Column real_email does not exist"

**Solución**: Ejecutar la migración SQL
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS real_email TEXT;
```

### Error: "Cannot login with real email"

**Solución**: Poblar la columna real_email
```sql
UPDATE profiles SET real_email = email WHERE real_email IS NULL;
```

### Ver más soluciones en:
- `INSTRUCCIONES_ALUMNOS_DUPLICADOS.md` - Sección "Solución de Problemas"
- `GUIA_PRUEBAS_DUPLICADOS.md` - Sección "Problemas Comunes"

## 📞 Soporte

Para problemas o preguntas:

1. Revisar la documentación en este directorio
2. Verificar logs de Supabase
3. Ejecutar script de verificación: `verify_real_email_migration.sql`
4. Contactar al equipo de desarrollo

## 📝 Changelog

### Versión 1.0.0 (2024-12-20)

- ✨ Implementación inicial del sistema de alumnos duplicados
- ✨ Migración de base de datos para columna real_email
- ✨ Actualización de lógica de autenticación
- ✨ Documentación completa
- ✨ Guías de prueba y verificación

## 👥 Contribuidores

- Equipo de Desarrollo - Conexión América

## 📄 Licencia

Este proyecto es parte del sistema LUNO - Conexión América.

---

**Última actualización**: 20 de Diciembre, 2024
**Versión**: 1.0.0
**Estado**: ✅ Implementación Completa
