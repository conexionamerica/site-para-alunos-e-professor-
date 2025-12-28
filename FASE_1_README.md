# 🚀 FASE 1: Código de Alumno + Vinculación a Profesor

## Resumen de Cambios Realizados

Esta fase implementa:
1. ✅ Código único de alumno (formato 0101010 - 7 dígitos)
2. ✅ Vinculación de alumno a profesor (columna assigned_professor_id)
3. ✅ Visualización del código en la tabla de alunos

---

## 📋 Instrucciones de Implementación

### Paso 1: Ejecutar Script SQL en Supabase

1. Accede a tu proyecto en **Supabase**
2. Ve a **SQL Editor** (menú lateral izquierdo)
3. Copia y pega el contenido del archivo:
   ```
   supabase/migrations/FASE_1_student_code_professor_link.sql
   ```
4. Haz clic en **Run** para ejecutar

### Paso 2: Verificar Resultados

Después de ejecutar, deberías ver:
- Resultados mostrando las columnas creadas
- Lista de alumnos con sus códigos asignados
- Resumen de códigos asignados

Ejemplo de resultado esperado:
```
| descripcion          | cantidad |
|----------------------|----------|
| Total alumnos        | 15       |
| Con código asignado  | 15       |
| Sin código           | 0        |
```

### Paso 3: Verificar en el Frontend

1. Inicia el servidor de desarrollo: `npm run dev`
2. Accede al portal del profesor
3. Ve a la pestaña "Alunos"
4. Ahora verás la columna "Código" con el código de cada alumno

---

## 🗄️ Cambios en Base de Datos

### Nuevas Columnas en tabla `profiles`:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `student_code` | VARCHAR(7) | Código único del alumno (ej: 0101010) |
| `assigned_professor_id` | UUID | ID del profesor asignado (puede ser NULL) |

### Nuevas Funciones:

| Función | Propósito |
|---------|-----------|
| `generate_student_code()` | Genera el próximo código disponible |
| `set_student_code_on_insert()` | Trigger para auto-asignar código |

### Trigger:

- `trigger_set_student_code`: Se ejecuta antes de insertar un nuevo alumno

---

## 📁 Archivos Modificados

### Frontend:

| Archivo | Cambio |
|---------|--------|
| `AlunosTab.jsx` | Nueva columna "Código" en la tabla |

### Base de Datos:

| Archivo | Cambio |
|---------|--------|
| `FASE_1_student_code_professor_link.sql` | Script completo para Supabase |

---

## ⚙️ Comportamiento del Sistema

### Auto-generación de Código:

- Cuando se crea un nuevo usuario con `role = 'student'`
- El trigger automáticamente asigna el siguiente código disponible
- Secuencia: 0101010, 0101011, 0101012, ...

### Códigos para Alumnos Existentes:

- El script asigna códigos secuenciales a todos los alumnos existentes
- Ordenados por fecha de creación (`created_at`)

---

## ✅ Checklist de Fase 1

- [ ] Ejecutar script SQL en Supabase
- [ ] Verificar que los códigos fueron asignados
- [ ] Probar que nuevos alumnos reciben código automáticamente
- [ ] Verificar columna "Código" en el frontend
- [ ] Hacer deploy a Vercel (después de probar)

---

## 🔜 Próxima Fase

La **Fase 2** incluirá:
- Sistema completo de superusuario
- Nuevo perfil con acceso global
- Menú de Administración con submenus
- Filtros de profesor en todas las tabs

---

*Creado: 2025-12-28*
*Versión: 1.0*
