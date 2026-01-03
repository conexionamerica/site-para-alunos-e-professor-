-- Migration: Incluir horário preferido nas notificações de vinculação/realocação
-- Data: 2026-01-03

-- 1. Atualizar notify_new_student_assignment
CREATE OR REPLACE FUNCTION notify_new_student_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_student_name TEXT;
    v_professor_name TEXT;
    v_assigned_by UUID;
    v_preferred_schedule JSONB;
BEGIN
    SELECT full_name, preferred_schedule INTO v_student_name, v_preferred_schedule FROM profiles WHERE id = NEW.id;
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
            'assigned_by', v_assigned_by,
            'preferred_schedule', v_preferred_schedule
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
                'professor_id', NEW.assigned_professor_id,
                'professor_name', v_professor_name,
                'preferred_schedule', v_preferred_schedule
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar notify_student_reallocation
CREATE OR REPLACE FUNCTION notify_student_reallocation()
RETURNS TRIGGER AS $$
DECLARE
    v_student_name TEXT;
    v_old_professor_name TEXT;
    v_new_professor_name TEXT;
    v_reallocated_by UUID;
    v_preferred_schedule JSONB;
BEGIN
    IF NEW.assigned_professor_id IS DISTINCT FROM OLD.assigned_professor_id AND NEW.assigned_professor_id IS NOT NULL THEN
        SELECT full_name, preferred_schedule INTO v_student_name, v_preferred_schedule FROM profiles WHERE id = NEW.id;
        SELECT full_name INTO v_old_professor_name FROM profiles WHERE id = OLD.assigned_professor_id;
        SELECT full_name INTO v_new_professor_name FROM profiles WHERE id = NEW.assigned_professor_id;
        v_reallocated_by := auth.uid();
        
        IF v_reallocated_by IS NULL THEN
            SELECT id INTO v_reallocated_by FROM profiles WHERE role = 'superadmin' LIMIT 1;
        END IF;
        
        -- Notificação para o NOVO professor
        INSERT INTO notifications (
            type, title, description, user_id, related_user_id,
            related_entity_type, related_entity_id, metadata
        ) VALUES (
            'student_reallocation',
            'Aluno Realocado para Você',
            'O aluno ' || v_student_name || ' foi transferido para você. Verifique os agendamentos.',
            NEW.assigned_professor_id,
            NEW.id,
            'student_reallocation',
            NEW.id,
            jsonb_build_object(
                'student_id', NEW.id,
                'student_name', v_student_name,
                'old_professor_id', OLD.assigned_professor_id,
                'old_professor_name', v_old_professor_name,
                'new_professor_id', NEW.assigned_professor_id,
                'reallocated_by', v_reallocated_by,
                'preferred_schedule', v_preferred_schedule
            )
        );
        
        -- Notificação de pendência para admin
        IF v_reallocated_by IS NOT NULL THEN
            INSERT INTO notifications (
                type, title, description, user_id, related_user_id,
                related_entity_type, related_entity_id, metadata
            ) VALUES (
                'schedule_request',
                'Aguardando Reagendamento',
                'Aluno ' || v_student_name || ' transferido de ' || v_old_professor_name || ' para ' || v_new_professor_name || '.',
                v_reallocated_by,
                NEW.id,
                'student_reallocation',
                NEW.id,
                jsonb_build_object(
                    'student_id', NEW.id,
                    'student_name', v_student_name,
                    'old_professor_id', OLD.assigned_professor_id,
                    'old_professor_name', v_old_professor_name,
                    'new_professor_id', NEW.assigned_professor_id,
                    'new_professor_name', v_new_professor_name,
                    'preferred_schedule', v_preferred_schedule
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
