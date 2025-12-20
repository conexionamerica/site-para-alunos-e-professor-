# 🚨 SOLUCIÓN URGENTE - Usuarios No Aparecen

## ⚠️ PROBLEMA

Los usuarios que se registran NO aparecen en:
- ❌ Panel del profesor
- ❌ Tabla `profiles` en Supabase
- ❌ Ningún lado

## 🔍 CAUSA

El **trigger de Supabase** que crea automáticamente el perfil cuando un usuario se registra **NO ESTÁ ACTUALIZADO** o no existe.

## ✅ SOLUCIÓN INMEDIATA

### PASO 1: Acceder a Supabase

1. Ve a: **https://supabase.com/dashboard**
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral izquierdo

### PASO 2: Ejecutar el Script de Emergencia

1. Crea una nueva query (botón "+ New query")
2. Copia **TODO** el contenido del archivo:
   ```
   supabase/migrations/EMERGENCIA_RECUPERAR_USUARIOS.sql
   ```
3. Pégalo en el editor SQL
4. Haz clic en **RUN** (o presiona Ctrl+Enter)

### PASO 3: Verificar Resultados

Después de ejecutar el script, verás una tabla con 3 filas:

```
descripcion                              | cantidad
-----------------------------------------|----------
Total usuarios en auth.users             | X
Total perfiles en profiles               | X
Usuarios sin perfil (debería ser 0)      | 0
```

✅ **Si "Usuarios sin perfil" = 0**, el problema está resuelto.

---

## 📋 Qué Hace el Script

### 1. Crea/Actualiza el Trigger
- Asegura que cuando un usuario se registre, se cree su perfil automáticamente
- Incluye el campo `real_email` para el sistema de duplicados

### 2. Recupera Usuarios Perdidos
- Busca usuarios en `auth.users` que NO tienen perfil en `profiles`
- Crea los perfiles faltantes con sus datos

### 3. Actualiza Datos Existentes
- Agrega la columna `real_email` si no existe
- Crea el índice para búsquedas rápidas
- Actualiza usuarios existentes

---

## 🧪 Verificar que Funcionó

### Opción 1: Verificar en Supabase

1. Ve a **Table Editor** → **profiles**
2. Deberías ver TODOS los usuarios, incluyendo el que se registró recientemente
3. Verifica que tenga:
   - ✅ `email` (puede ser interno: `student_123_abc@internal...`)
   - ✅ `real_email` (el email real del usuario)
   - ✅ `full_name`
   - ✅ `username`

### Opción 2: Verificar en el Panel del Profesor

1. Inicia sesión como profesor
2. Ve a la pestaña **Alunos** o **Administração**
3. Deberías ver el nuevo alumno en la lista

---

## 🔄 Probar Nuevo Registro

Después de ejecutar el script, prueba registrar un nuevo alumno:

1. Ve a: https://luno.conexionamerica.com.br/register
2. Registra un alumno de prueba:
   - Nombre: Test Usuario
   - Email: test123@example.com
   - Usuario: testusuario
   - Contraseña: Test123!

3. Verifica INMEDIATAMENTE en Supabase:
   - Ve a **Table Editor** → **profiles**
   - Busca "Test Usuario"
   - ✅ Debería aparecer INMEDIATAMENTE

---

## 📊 Consultas Útiles

### Ver Todos los Usuarios

```sql
SELECT 
  p.id,
  p.email,
  p.real_email,
  p.full_name,
  p.username,
  p.role,
  p.is_active,
  p.created_at
FROM profiles p
ORDER BY p.created_at DESC;
```

### Ver Usuarios Registrados Hoy

```sql
SELECT 
  p.full_name,
  p.real_email,
  p.username,
  p.created_at
FROM profiles p
WHERE p.created_at >= CURRENT_DATE
ORDER BY p.created_at DESC;
```

### Buscar Usuario Específico por Email Real

```sql
SELECT * FROM profiles 
WHERE real_email = 'email@del-usuario.com';
```

### Ver Usuarios sin Perfil (Debería estar vacío)

```sql
SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as nombre,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;
```

---

## ⚠️ Si el Problema Persiste

### 1. Verificar que el Trigger Existe

```sql
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Deberías ver:
- `trigger_name`: on_auth_user_created
- `event_object_table`: users
- `action_statement`: EXECUTE FUNCTION handle_new_user()

### 2. Verificar que la Función Existe

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

Deberías ver la función `handle_new_user` con su código.

### 3. Probar el Trigger Manualmente

Si un usuario específico no tiene perfil, puedes crearlo manualmente:

```sql
-- Reemplaza 'USER_ID_AQUI' con el ID del usuario
INSERT INTO public.profiles (id, email, username, full_name, role, real_email, is_active)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'username', ''),
  COALESCE(u.raw_user_meta_data->>'full_name', 'Usuario'),
  COALESCE(u.raw_user_meta_data->>'role', 'student'),
  COALESCE(u.raw_user_meta_data->>'real_email', u.email),
  true
FROM auth.users u
WHERE u.id = 'USER_ID_AQUI';
```

---

## 📞 Checklist de Solución

- [ ] Ejecuté el script `EMERGENCIA_RECUPERAR_USUARIOS.sql` en Supabase
- [ ] Verifiqué que "Usuarios sin perfil" = 0
- [ ] Verifiqué en Table Editor → profiles que aparecen todos los usuarios
- [ ] Probé registrar un nuevo usuario
- [ ] El nuevo usuario aparece inmediatamente en profiles
- [ ] El nuevo usuario aparece en el panel del profesor

---

## ✅ Resultado Esperado

Después de ejecutar el script:

1. ✅ Todos los usuarios existentes aparecen en `profiles`
2. ✅ El alumno que se registró recientemente aparece
3. ✅ Nuevos registros crean el perfil automáticamente
4. ✅ El panel del profesor muestra todos los alumnos
5. ✅ El sistema funciona normalmente

---

**EJECUTA EL SCRIPT AHORA MISMO Y VERIFICA LOS RESULTADOS** 🚀

---

**Última actualización**: 20 de Diciembre, 2024  
**Prioridad**: 🚨 URGENTE  
**Estado**: ⏳ Esperando ejecución del script
