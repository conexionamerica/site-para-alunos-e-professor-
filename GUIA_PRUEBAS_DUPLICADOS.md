# Guía de Pruebas - Sistema de Alumnos Duplicados

## 🧪 Escenarios de Prueba

### Escenario 1: Registro de Dos Alumnos con el Mismo Email

#### Paso 1: Registrar el Primer Alumno
1. Ir a la página de registro: `http://luno.conexionamerica.com.br/register`
2. Completar el formulario:
   - **Nombre Completo**: Juan Pérez
   - **Nombre de Usuario**: juanperez
   - **Email**: test@example.com
   - **Contraseña**: Password123!
3. Hacer clic en "Crear Cuenta de Aluno"
4. ✅ **Resultado Esperado**: Registro exitoso y redirección al dashboard

#### Paso 2: Cerrar Sesión
1. Hacer clic en el botón de cerrar sesión
2. ✅ **Resultado Esperado**: Redirección a la página de login

#### Paso 3: Registrar el Segundo Alumno (Mismo Email)
1. Ir a la página de registro: `http://luno.conexionamerica.com.br/register`
2. Completar el formulario con **EL MISMO EMAIL**:
   - **Nombre Completo**: María García
   - **Nombre de Usuario**: mariagarcia
   - **Email**: test@example.com (mismo que antes)
   - **Contraseña**: Password456!
3. Hacer clic en "Crear Cuenta de Aluno"
4. ✅ **Resultado Esperado**: Registro exitoso (no debe mostrar error de email duplicado)

---

### Escenario 2: Login con Email Duplicado

#### Paso 1: Login con el Primer Alumno
1. Ir a la página de login: `http://luno.conexionamerica.com.br/login`
2. Ingresar credenciales:
   - **Email**: test@example.com
   - **Contraseña**: Password123!
3. Hacer clic en "Entrar"
4. ✅ **Resultado Esperado**: Login exitoso como Juan Pérez

#### Paso 2: Verificar Información del Usuario
1. En el dashboard, verificar que el nombre mostrado sea "Juan Pérez"
2. ✅ **Resultado Esperado**: Información correcta del primer alumno

#### Paso 3: Cerrar Sesión y Login con el Segundo Alumno
1. Cerrar sesión
2. Ir a la página de login
3. Ingresar credenciales:
   - **Email**: test@example.com (mismo email)
   - **Contraseña**: Password456! (contraseña del segundo alumno)
4. Hacer clic en "Entrar"
5. ✅ **Resultado Esperado**: Login exitoso como María García

---

### Escenario 3: Verificación en el Panel del Profesor

#### Paso 1: Login como Profesor
1. Ir a: `http://luno.conexionamerica.com.br/professor-login`
2. Ingresar credenciales de profesor
3. ✅ **Resultado Esperado**: Acceso al dashboard del profesor

#### Paso 2: Ver Lista de Alumnos
1. Ir a la pestaña "Alunos"
2. Buscar alumnos con el email "test@example.com"
3. ✅ **Resultado Esperado**: Deben aparecer ambos alumnos:
   - Juan Pérez - test@example.com
   - María García - test@example.com

#### Paso 3: Verificar en la Pestaña de Administración
1. Ir a la pestaña "Administração"
2. Ver la lista de alumnos
3. ✅ **Resultado Esperado**: Ambos alumnos deben mostrar "test@example.com" en la columna de Email

---

### Escenario 4: Recuperación de Contraseña

#### Paso 1: Solicitar Recuperación de Contraseña
1. Ir a la página de login
2. Hacer clic en "Esqueci a minha senha"
3. Ingresar: test@example.com
4. Hacer clic en enviar
5. ✅ **Resultado Esperado**: Mensaje de éxito indicando que se envió el email

#### Nota Importante
⚠️ Si hay múltiples usuarios con el mismo email, el link de recuperación se enviará al **primer usuario registrado** con ese email (Juan Pérez en este caso).

---

### Escenario 5: Verificación en la Base de Datos

#### Paso 1: Verificar Emails Internos en Supabase
1. Ir al SQL Editor de Supabase
2. Ejecutar:
```sql
SELECT id, email, real_email, full_name, username
FROM profiles
WHERE real_email = 'test@example.com'
ORDER BY created_at;
```
3. ✅ **Resultado Esperado**: Dos registros con:
   - Diferentes `email` (emails internos únicos)
   - Mismo `real_email` (test@example.com)
   - Diferentes `full_name` (Juan Pérez y María García)

#### Ejemplo de Resultado:
```
id                                   | email                                              | real_email         | full_name     | username
-------------------------------------|----------------------------------------------------|--------------------|---------------|-------------
abc123...                            | student_1703012345_abc123@internal.conexion...     | test@example.com   | Juan Pérez    | juanperez
def456...                            | student_1703012789_def456@internal.conexion...     | test@example.com   | María García  | mariagarcia
```

---

### Escenario 6: Registro con Mismo Nombre y Usuario

#### Paso 1: Registrar Tercer Alumno
1. Ir a la página de registro
2. Completar el formulario:
   - **Nombre Completo**: Juan Pérez (mismo nombre que el primero)
   - **Nombre de Usuario**: juanperez (mismo usuario que el primero)
   - **Email**: test@example.com (mismo email)
   - **Contraseña**: Password789!
3. Hacer clic en "Crear Conta de Aluno"
4. ✅ **Resultado Esperado**: Registro exitoso (permite duplicados completos)

---

## 🔍 Checklist de Verificación

Después de ejecutar la migración, verificar:

- [ ] La columna `real_email` existe en la tabla `profiles`
- [ ] El índice `idx_profiles_real_email` fue creado
- [ ] El trigger `handle_new_user()` incluye el campo `real_email`
- [ ] Todos los perfiles existentes tienen `real_email` poblado
- [ ] Se pueden registrar múltiples alumnos con el mismo email
- [ ] El login funciona correctamente con emails duplicados
- [ ] El panel del profesor muestra el email real (no el interno)
- [ ] La recuperación de contraseña funciona

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Error "Column real_email does not exist"
**Causa**: La migración no se ejecutó correctamente
**Solución**: 
```sql
-- Ejecutar en SQL Editor de Supabase
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS real_email TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_real_email ON profiles(real_email);
UPDATE profiles SET real_email = email WHERE real_email IS NULL;
```

### Problema 2: No se puede hacer login con email real
**Causa**: La columna `real_email` no está poblada
**Solución**:
```sql
UPDATE profiles SET real_email = email WHERE real_email IS NULL;
```

### Problema 3: El trigger no funciona
**Causa**: El trigger no se actualizó correctamente
**Solución**: Ejecutar nuevamente la sección del trigger en `add_real_email_column.sql`

### Problema 4: Se muestra el email interno en lugar del real
**Causa**: El componente no está usando `real_email`
**Solución**: Verificar que los componentes usen `profile.real_email || profile.email`

---

## 📊 Métricas de Éxito

El sistema funciona correctamente si:

1. ✅ Puedes registrar 2+ alumnos con el mismo email
2. ✅ Puedes hacer login con cada uno usando su contraseña única
3. ✅ El panel del profesor muestra el email real
4. ✅ No hay errores en la consola del navegador
5. ✅ Los emails internos no son visibles para los usuarios

---

## 📝 Notas Adicionales

- Los emails internos tienen el formato: `student_[timestamp]_[random]@internal.conexionamerica.com.br`
- El timestamp asegura unicidad temporal
- El string random asegura unicidad en caso de registros simultáneos
- El dominio `@internal.conexionamerica.com.br` identifica claramente que son emails internos
- Los usuarios nunca ven estos emails internos en la interfaz

---

## 🎯 Próximos Pasos

Después de verificar que todo funciona:

1. ✅ Documentar el comportamiento para el equipo
2. ✅ Informar a los usuarios sobre la nueva funcionalidad
3. ✅ Monitorear logs para detectar posibles problemas
4. ✅ Considerar implementar un sistema de búsqueda mejorado para distinguir entre usuarios con el mismo email

---

## 📞 Soporte

Si encuentras algún problema durante las pruebas:

1. Revisar los logs de la consola del navegador (F12)
2. Revisar los logs de Supabase
3. Ejecutar el script de verificación: `verify_real_email_migration.sql`
4. Contactar al equipo de desarrollo con los detalles del error
