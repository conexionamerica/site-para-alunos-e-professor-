-- Script de Migração: Vincular todos os alunos ao professor admin
-- Execute este SQL no Supabase SQL Editor

-- Primeiro, vamos identificar o professor admin
-- (assumindo que é um usuário com role='professor' ou 'superadmin' e nome contendo 'admin')

-- Opção 1: Se o admin for um superadmin que também age como professor
-- Este script busca o primeiro superadmin e vincula todos os alunos a ele

DO $$
DECLARE
    admin_professor_id UUID;
    affected_rows INTEGER;
BEGIN
    -- Buscar o ID do professor/superadmin admin
    -- Tenta primeiro buscar por superadmin
    SELECT id INTO admin_professor_id
    FROM profiles
    WHERE role = 'superadmin'
    ORDER BY created_at ASC
    LIMIT 1;

    -- Se não encontrar superadmin, busca professor com 'admin' no nome ou email
    IF admin_professor_id IS NULL THEN
        SELECT id INTO admin_professor_id
        FROM profiles
        WHERE role = 'professor' 
          AND (LOWER(full_name) LIKE '%admin%' OR LOWER(email) LIKE '%admin%')
        LIMIT 1;
    END IF;

    -- Se encontrou um admin, atualiza todos os alunos sem professor vinculado
    IF admin_professor_id IS NOT NULL THEN
        UPDATE profiles
        SET assigned_professor_id = admin_professor_id
        WHERE role = 'student'
          AND (assigned_professor_id IS NULL OR assigned_professor_id != admin_professor_id);

        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        RAISE NOTICE 'Professor Admin ID: %', admin_professor_id;
        RAISE NOTICE 'Alunos atualizados: %', affected_rows;
    ELSE
        RAISE NOTICE 'Nenhum professor admin encontrado!';
    END IF;
END $$;

-- Verificar o resultado
SELECT 
    p.full_name AS aluno,
    p.student_code,
    p.assigned_professor_id,
    prof.full_name AS professor_vinculado
FROM profiles p
LEFT JOIN profiles prof ON prof.id = p.assigned_professor_id
WHERE p.role = 'student'
ORDER BY p.full_name;

-- Listar professores/admins disponíveis para referência
SELECT id, full_name, role, email 
FROM profiles 
WHERE role IN ('professor', 'superadmin')
ORDER BY role, full_name;
