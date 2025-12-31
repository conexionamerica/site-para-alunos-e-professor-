-- Migration: Sistema de Notificações e Pendências
-- Cria tabela unificada de notificações com triggers automáticos

-- 1. TABELA PRINCIPAL
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN (
        'new_student_assignment',
        'student_reallocation', 
        'plan_expiring',
        'schedule_request',
        'general'
    )),
    title TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    related_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    related_entity_type TEXT,
    related_entity_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'read',
        'accepted',
        'rejected',
        'archived'
    )),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
);

-- 2. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_type_status ON notifications(type, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_entity_type, related_entity_id);

-- 3. RLS POLICIES
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuários veem suas próprias notificações
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Admin vê todas as notificações tipo schedule_request
DROP POLICY IF EXISTS "Admins see schedule requests" ON notifications;
CREATE POLICY "Admins see schedule requests"
ON notifications FOR SELECT
USING (
    type = 'schedule_request' 
    AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'superadmin')
    )
);

-- Usuários atualizam suas próprias notificações
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Sistema cria notificações (via triggers)
DROP POLICY IF EXISTS "System creates notifications" ON notifications;
CREATE POLICY "System creates notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- 4. FUNÇÕES E TRIGGERS

-- 4.1 Função: Notificar nova vinculação de aluno
CREATE OR REPLACE FUNCTION notify_new_student_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_student_name TEXT;
    v_professor_name TEXT;
    v_assigned_by UUID;
BEGIN
    -- Buscar informações necessárias
    SELECT full_name INTO v_student_name FROM profiles WHERE id = NEW.id;
    SELECT full_name INTO v_professor_name FROM profiles WHERE id = NEW.professor_id;
    v_assigned_by := auth.uid();
    
    -- Se não conseguir pegar o auth.uid (trigger automático), usar um superadmin
    IF v_assigned_by IS NULL THEN
        SELECT id INTO v_assigned_by FROM profiles WHERE role = 'superadmin' LIMIT 1;
    END IF;
    
    -- Notificação para o professor
    INSERT INTO notifications (
        type,
        title,
        description,
        user_id,
        related_user_id,
        related_entity_type,
        related_entity_id,
        metadata
    ) VALUES (
        'new_student_assignment',
        'Novo Aluno Vinculado',
        'Você recebeu um novo aluno: ' || v_student_name || '. Agende as primeiras aulas.',
        NEW.professor_id,
        NEW.id,
        'student_assignment',
        NEW.id,
        jsonb_build_object(
            'student_id', NEW.id,
            'student_name', v_student_name,
            'assigned_by', v_assigned_by
        )
    );
    
    -- Notificação de pendência para admin (quem fez a vinculação)
    IF v_assigned_by IS NOT NULL THEN
        INSERT INTO notifications (
            type,
            title,
            description,
            user_id,
            related_user_id,
            related_entity_type,
            related_entity_id,
            metadata
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
                'professor_id', NEW.professor_id,
                'professor_name', v_professor_name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Trigger para nova vinculação
DROP TRIGGER IF EXISTS on_student_professor_assigned ON profiles;
CREATE TRIGGER on_student_professor_assigned
AFTER INSERT ON profiles
FOR EACH ROW
WHEN (NEW.role = 'student' AND NEW.professor_id IS NOT NULL)
EXECUTE FUNCTION notify_new_student_assignment();

-- 4.2 Função: Notificar realocação de aluno
CREATE OR REPLACE FUNCTION notify_student_reallocation()
RETURNS TRIGGER AS $$
DECLARE
    v_student_name TEXT;
    v_old_professor_name TEXT;
    v_new_professor_name TEXT;
    v_reallocated_by UUID;
BEGIN
    -- Apenas se mudou o professor
    IF NEW.professor_id IS DISTINCT FROM OLD.professor_id AND NEW.professor_id IS NOT NULL THEN
        -- Buscar informações
        SELECT full_name INTO v_student_name FROM profiles WHERE id = NEW.id;
        SELECT full_name INTO v_old_professor_name FROM profiles WHERE id = OLD.professor_id;
        SELECT full_name INTO v_new_professor_name FROM profiles WHERE id = NEW.professor_id;
        v_reallocated_by := auth.uid();
        
        -- Se não conseguir pegar o auth.uid, usar um superadmin
        IF v_reallocated_by IS NULL THEN
            SELECT id INTO v_reallocated_by FROM profiles WHERE role = 'superadmin' LIMIT 1;
        END IF;
        
        -- Notificação para o NOVO professor
        INSERT INTO notifications (
            type,
            title,
            description,
            user_id,
            related_user_id,
            related_entity_type,
            related_entity_id,
            metadata
        ) VALUES (
            'student_reallocation',
            'Aluno Realocado para Você',
            'O aluno ' || v_student_name || ' foi transferido para você. Verifique os agendamentos.',
            NEW.professor_id,
            NEW.id,
            'student_reallocation',
            NEW.id,
            jsonb_build_object(
                'student_id', NEW.id,
                'student_name', v_student_name,
                'old_professor_id', OLD.professor_id,
                'old_professor_name', v_old_professor_name,
                'new_professor_id', NEW.professor_id,
                'reallocated_by', v_reallocated_by
            )
        );
        
        -- Notificação de pendência para admin
        IF v_reallocated_by IS NOT NULL THEN
            INSERT INTO notifications (
                type,
                title,
                description,
                user_id,
                related_user_id,
                related_entity_type,
                related_entity_id,
                metadata
            ) VALUES (
                'schedule_request',
                'Aguardando Reagendamento',
                'Aluno ' || v_student_name || ' transferido de ' || v_old_professor_name || ' para ' || v_new_professor_name || '. Aguardando novo agendamento.',
                v_reallocated_by,
                NEW.id,
                'student_reallocation',
                NEW.id,
                jsonb_build_object(
                    'student_id', NEW.id,
                    'student_name', v_student_name,
                    'old_professor_id', OLD.professor_id,
                    'old_professor_name', v_old_professor_name,
                    'new_professor_id', NEW.professor_id,
                    'new_professor_name', v_new_professor_name
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_student_professor_changed ON profiles;
CREATE TRIGGER on_student_professor_changed
AFTER UPDATE ON profiles
FOR EACH ROW
WHEN (NEW.role = 'student')
EXECUTE FUNCTION notify_student_reallocation();

-- 4.3 Função: Verificar planos expirando (5 dias)
CREATE OR REPLACE FUNCTION check_expiring_plans()
RETURNS void AS $$
BEGIN
    INSERT INTO notifications (
        type,
        title,
        description,
        user_id,
        related_user_id,
        related_entity_type,
        related_entity_id,
        metadata
    )
    SELECT DISTINCT
        'plan_expiring',
        '⚠️ Seu Plano Está Acabando',
        'Seu plano de ' || b.billing_amount::text || ' aulas/' || b.billing_period || 
        ' vence em ' || EXTRACT(DAY FROM (b.end_date - CURRENT_DATE))::text || ' dias (' || 
        TO_CHAR(b.end_date, 'DD/MM/YYYY') || ').',
        p.id,
        p.id,
        'billing',
        b.id::text::uuid,
        jsonb_build_object(
            'billing_id', b.id,
            'end_date', b.end_date,
            'days_remaining', EXTRACT(DAY FROM (b.end_date - CURRENT_DATE)),
            'billing_amount', b.billing_amount,
            'billing_period', b.billing_period
        )
    FROM profiles p
    JOIN billing b ON p.id = b.user_id
    WHERE p.role = 'student'
    AND b.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '5 days')
    AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = p.id
        AND n.type = 'plan_expiring'
        AND n.related_entity_id::text = b.id::text
        AND n.status IN ('pending', 'read')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Comentário: Esta função deve ser chamada diariamente via cron job ou edge function
-- Exemplo de como chamar: SELECT check_expiring_plans();
