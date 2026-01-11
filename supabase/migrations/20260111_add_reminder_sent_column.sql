-- Migración para agregar columna reminder_sent a appointments
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna para rastrear si el recordatorio fue enviado
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reminder_sent TIMESTAMPTZ DEFAULT NULL;

-- 2. Crear índice para mejorar performance de las consultas del cron
CREATE INDEX IF NOT EXISTS idx_appointments_reminder 
ON appointments (class_datetime, status, reminder_sent) 
WHERE status = 'scheduled' AND reminder_sent IS NULL;

-- 3. Comentario descriptivo
COMMENT ON COLUMN appointments.reminder_sent IS 'Timestamp de cuando se envió el email de recordatorio';
