# Instrucciones para Permitir Alumnos Duplicados

## Cambios Realizados

Se ha modificado el sistema para permitir que múltiples alumnos se registren con el mismo nombre, correo electrónico y nombre de usuario. 

### ¿Cómo funciona?

1. **Registro**: Cuando un alumno se registra, el sistema genera un email único interno (ej: `student_1234567890_abc123@internal.conexionamerica.com.br`) para Supabase Auth, pero guarda el email real del usuario en los metadatos.

2. **Login**: Cuando un alumno inicia sesión, el sistema busca su email real en la base de datos y luego usa el email interno para autenticarse.

3. **Visualización**: En todas las interfaces, se muestra el email real del usuario, no el email interno.

## Pasos para Implementar

### 1. Ejecutar la Migración SQL en Supabase

1. Accede a tu proyecto de Supabase: https://supabase.com/dashboard
2. Ve a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido del archivo: `site-para-alunos-e-professor-/supabase/migrations/add_real_email_column.sql`
5. Ejecuta la query (botón "Run" o Ctrl+Enter)

La migración hará lo siguiente:
- Agregará la columna `real_email` a la tabla `profiles`
- Creará un índice para búsquedas rápidas
- Actualizará el trigger de creación de usuarios para incluir el email real
- Actualizará los registros existentes

### 2. Verificar la Migración

Ejecuta esta query en el SQL Editor para verificar que la columna se creó correctamente:

```sql
SELECT id, email, real_email, full_name, username 
FROM profiles 
LIMIT 10;
```

### 3. Reiniciar la Aplicación

Si la aplicación está corriendo, reiníciala para que los cambios tomen efecto:

```bash
npm run dev
```

## Pruebas

### Probar Registro de Alumnos Duplicados

1. Registra un alumno con:
   - Email: `test@example.com`
   - Nombre: `Juan Pérez`
   - Usuario: `juanperez`
   - Contraseña: `password123`

2. Registra otro alumno con los MISMOS datos:
   - Email: `test@example.com`
   - Nombre: `Juan Pérez`
   - Usuario: `juanperez`
   - Contraseña: `password456` (puede ser diferente)

3. Ambos registros deberían completarse exitosamente.

### Probar Login

1. Intenta iniciar sesión con `test@example.com` y `password123`
   - Debería iniciar sesión con el primer alumno

2. Cierra sesión e intenta con `test@example.com` y `password456`
   - Debería iniciar sesión con el segundo alumno

## Notas Importantes

- **Emails Internos**: Los emails internos generados son únicos y no se muestran a los usuarios.
- **Recuperación de Contraseña**: Si hay múltiples usuarios con el mismo email real, el link de recuperación se enviará al primer usuario encontrado.
- **Base de Datos**: Los usuarios existentes se actualizarán automáticamente con la migración, copiando su email de Auth como `real_email`.

## Archivos Modificados

1. `src/contexts/SupabaseAuthContext.jsx` - Lógica de autenticación actualizada
2. `src/components/professor-dashboard/AdmTab.jsx` - Muestra email real en lugar de interno
3. `supabase/migrations/add_real_email_column.sql` - Migración de base de datos

## Solución de Problemas

### Error: "Column real_email does not exist"

Ejecuta la migración SQL en Supabase.

### Los usuarios no pueden iniciar sesión

Verifica que la columna `real_email` esté poblada correctamente:

```sql
SELECT id, email, real_email FROM profiles WHERE real_email IS NULL;
```

Si hay registros sin `real_email`, actualízalos:

```sql
UPDATE profiles SET real_email = email WHERE real_email IS NULL;
```

### El login no funciona con el email real

Verifica que el trigger `handle_new_user()` esté actualizado correctamente ejecutando:

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

## Contacto

Si tienes problemas con la implementación, revisa los logs de la consola del navegador y los logs de Supabase para más detalles.
