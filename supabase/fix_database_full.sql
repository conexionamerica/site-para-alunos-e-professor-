-- SCRIPT DE CORREÇÃO COMPLETA (TRIGGERS + PERMISSÕES)

-- PARTE 1: CORREÇÃO DO ERRO "record new has no field id" (SOLICITAÇÕES)
-- Remove triggers que tentam acessar 'id' onde não existe
DROP TRIGGER IF EXISTS handle_updated_at ON public.solicitudes_clase;
DROP TRIGGER IF EXISTS set_updated_at ON public.solicitudes_clase;
DROP TRIGGER IF EXISTS update_solicitudes_clase_modtime ON public.solicitudes_clase;

-- Recria trigger seguro para updated_at (opcional, apenas se updated_at existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'solicitudes_clase' AND column_name = 'updated_at') THEN
        DROP TRIGGER IF EXISTS update_solicitudes_clase_updated_at ON public.solicitudes_clase;
        
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


-- PARTE 2: CORREÇÃO DAS PERMISSÕES DE INSERT (ERRO RLS AO ENVIAR SOLICITAÇÃO)
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


-- PARTE 3: CORREÇÃO DO MATCH (ADMIN NÃO VÊ AGENDAS DE OUTROS PROFESSORES)
-- Permitir que Admin/Superadmin vejam TODOS os appointments para calcular disponibilidade
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
