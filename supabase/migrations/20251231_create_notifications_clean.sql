```
CREATE FUNCTION notify_new_student_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_student_name TEXT;
    v_professor_name TEXT;
    v_assigned_by UUID;
BEGIN
    SELECT full_name INTO v_student_name FROM profiles WHERE id = NEW.id;
    SELECT full_name INTO v_professor_name FROM profiles WHERE id = NEW.assigned_professor_id;
    v_assigned_by := auth.uid();
    
    IF v_assigned_by IS NULL THEN
        SELECT id INTO v_assigned_by FROM profiles WHERE role = 'superadmin' LIMIT 1;
    END IF;
    
    -- Notificação para o professor
    INSERT INTO notifications (
        type, title, description, user_id, related_user_id,
        related_entity_type, related_entity_id, metadata
    ) VALUES (
        'new_student_assignment',
        'Novo Aluno Vinculado',
        'Você recebeu um novo aluno: ' || v_student_name || '. Agende as primeiras aulas.',
        NEW.assigned_professor_id,
        NEW.id,
        'student_assignment',
        NEW.id,
        jsonb_build_object(
            'student_id', NEW.id,
            'student_name', v_student_name,
            'assigned_by', v_assigned_by
        )
    );
    
    -- Notificação de pendência para admin
    IF v_assigned_by IS NOT NULL THEN
        INSERT INTO notifications (
            type, title, description, user_id, related_user_id,
            related_entity_type, related_entity_id, metadata
        ) VALUES (
            'schedule_request',
            'Aguardando Agendamento',
            'Aluno ' || v_student_name || ' vinculado ao professor ' || v_professor_name || '. Aguardando agendamento.',
            v_assigned_by,
            NEW.id,
            'student_assignment',
            NEW.id,
            jsonb_build_object(
                'student_id', NEW.id,
                'student_name', v_student_name,
                'assigned_professor_id', NEW.assigned_professor_id,
                'professor_name', v_professor_name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```