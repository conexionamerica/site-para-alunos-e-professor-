-- SCRIPT DE CORREÇÃO "NUCLEAR" (Remove todos os triggers e refaz permissões)

-- 1. REMOVER TODOS OS TRIGGERS DA TABELA solicitudes_clase
-- (Isso resolve com certeza o erro "record new has no field id")
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'solicitudes_clase') LOOP
        RAISE NOTICE 'Removendo trigger: %', r.trigger_name;
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.solicitudes_clase CASCADE;';
    END LOOP;
END $$;

-- 2. RECRIA APENAS O TRIGGER NECESSÁRIO (UPDATED_AT) DE FORMA SEGURA
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes_clase' AND column_name = 'updated_at') THEN
        CREATE OR REPLACE FUNCTION update_solicitudes_updated_at()
        RETURNS TRIGGER AS '
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        ' LANGUAGE plpgsql;

        CREATE TRIGGER update_solicitudes_clase_updated_at
        BEFORE UPDATE ON public.solicitudes_clase
        FOR EACH ROW
        EXECUTE PROCEDURE update_solicitudes_updated_at();
    END IF;
END $$;

-- 3. REAPLICAR PERMISSÕES RLS (INSERT E SELECT)
ALTER TABLE public.solicitudes_clase ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir Insert Autenticado" ON public.solicitudes_clase;
CREATE POLICY "Permitir Insert Autenticado" ON public.solicitudes_clase FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir Select Envolvidos e Admin" ON public.solicitudes_clase;
CREATE POLICY "Permitir Select Envolvidos e Admin" ON public.solicitudes_clase FOR SELECT USING (
    auth.uid() = alumno_id OR auth.uid() = profesor_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);

DROP POLICY IF EXISTS "Permitir Update Envolvidos e Admin" ON public.solicitudes_clase;
CREATE POLICY "Permitir Update Envolvidos e Admin" ON public.solicitudes_clase FOR UPDATE USING (
    auth.uid() = alumno_id OR auth.uid() = profesor_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);

-- 4. PERMITIR MATCH CORRETO (Visualização de Agendas)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Vê Todos Appointments" ON public.appointments;
CREATE POLICY "Admin Vê Todos Appointments" 
ON public.appointments 
FOR SELECT 
USING (
    auth.uid() = student_id 
    OR auth.uid() = professor_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'superadmin' OR role = 'admin'))
);
