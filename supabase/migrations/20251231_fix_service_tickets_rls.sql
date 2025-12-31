-- Corrigir RLS policies da tabela service_tickets para permitir admin criar tickets para professores

-- Remove policies antigas
DROP POLICY IF EXISTS "Professores criam tickets" ON service_tickets;
DROP POLICY IF EXISTS "Ver próprios tickets" ON service_tickets;
DROP POLICY IF EXISTS "Admins atualizam tickets" ON service_tickets;

-- POLICY 1: Permitir INSERT por professores (próprios tickets) E por superadmins (tickets para outros)
CREATE POLICY "Criar tickets"
ON service_tickets FOR INSERT
WITH CHECK (
    -- Professor cria ticket para si mesmo
    auth.uid() = requester_id
    OR
    -- Superadmin pode criar ticket para qualquer professor
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- POLICY 2: Ver tickets - professor vê seus próprios, admin vê todos
CREATE POLICY "Ver tickets"
ON service_tickets FOR SELECT
USING (
    -- Professor vê seus próprios tickets
    auth.uid() = requester_id
    OR
    -- Admin/Superadmin vê todos
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- POLICY 3: Apenas admins podem atualizar tickets (status, prioridade, etc)
CREATE POLICY "Atualizar tickets"
ON service_tickets FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- POLICY 4: Apenas admins podem deletar tickets (se necessário)
CREATE POLICY "Deletar tickets"
ON service_tickets FOR DELETE
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
);
