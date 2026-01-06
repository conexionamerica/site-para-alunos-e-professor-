
-- Tabela para centralizar notificações, erros e histórico do admin
CREATE TABLE IF NOT EXISTS public.admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'alert', 'error', 'resolution', 'expiry', 'schedule_change', 'assignment_resolved'
    title TEXT,
    message TEXT,
    details JSONB,
    student_id UUID REFERENCES public.profiles(id),
    professor_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'active', -- 'active', 'seen', 'resolved', 'archived'
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.admin_notifications;
CREATE POLICY "Admins can view all notifications"
    ON public.admin_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;
CREATE POLICY "Admins can manage notifications"
    ON public.admin_notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
        )
    );

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON public.admin_notifications(status);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON public.admin_notifications(created_at);
