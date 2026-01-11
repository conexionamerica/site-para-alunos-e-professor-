-- Migración para crear trigger de notificación de nuevo alumno
-- Ejecutar en Supabase SQL Editor

-- 1. Crear función para llamar al webhook cuando se asigna un nuevo alumno
CREATE OR REPLACE FUNCTION notify_new_student_assignment()
RETURNS TRIGGER AS $$
DECLARE
    professor_name TEXT;
    professor_email TEXT;
    student_name TEXT;
    student_email TEXT;
BEGIN
    -- Solo ejecutar si se asigna un nuevo profesor (era NULL o cambió)
    IF (OLD.assigned_professor_id IS NULL AND NEW.assigned_professor_id IS NOT NULL)
       OR (OLD.assigned_professor_id IS DISTINCT FROM NEW.assigned_professor_id AND NEW.assigned_professor_id IS NOT NULL) THEN
        
        -- Obtener datos del profesor
        SELECT full_name, real_email INTO professor_name, professor_email
        FROM profiles
        WHERE id = NEW.assigned_professor_id;
        
        -- Obtener datos del alumno
        SELECT full_name, real_email INTO student_name, student_email
        FROM profiles
        WHERE id = NEW.id;
        
        -- Insertar en la cola de notificaciones (procesada por un worker)
        INSERT INTO email_queue (
            email_type,
            recipient_email,
            recipient_name,
            subject,
            data,
            status,
            created_at
        ) VALUES (
            'new_student_assigned',
            professor_email,
            professor_name,
            '🎉 Novo aluno atribuído: ' || student_name,
            jsonb_build_object(
                'professor_id', NEW.assigned_professor_id,
                'professor_name', professor_name,
                'professor_email', professor_email,
                'student_id', NEW.id,
                'student_name', student_name,
                'student_email', student_email
            ),
            'pending',
            NOW()
        );
        
        RAISE NOTICE 'New student assignment notification queued for professor %', professor_email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear tabla de cola de emails si no existe
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_type TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear índice para emails pendientes
CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
ON email_queue (status, created_at) 
WHERE status = 'pending';

-- 4. Habilitar RLS en email_queue
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- 5. Política para que solo admins y el sistema puedan ver la cola
CREATE POLICY "Admins can manage email queue"
ON email_queue
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
);

-- 6. Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS trigger_notify_new_student ON profiles;

-- 7. Crear trigger para notificar cuando se asigna un alumno
CREATE TRIGGER trigger_notify_new_student
    AFTER UPDATE OF assigned_professor_id ON profiles
    FOR EACH ROW
    WHEN (NEW.role = 'student')
    EXECUTE FUNCTION notify_new_student_assignment();

-- 8. Comentarios
COMMENT ON TABLE email_queue IS 'Cola de emails pendientes de enviar';
COMMENT ON FUNCTION notify_new_student_assignment() IS 'Función que encola notificación cuando se asigna un alumno a un profesor';
