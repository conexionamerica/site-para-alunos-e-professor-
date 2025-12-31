-- Migração: Limpar permissões individuais e priorizar role_settings
-- Data: 2025-12-30
-- Objetivo: Remover permissões individuais da tabela profiles para que apenas role_settings seja usado

-- Limpar todas as permissões individuais existentes
-- Isso força o sistema a usar apenas as permissões do role_settings
UPDATE profiles
SET 
    can_manage_classes = NULL,
    can_manage_students = NULL
WHERE can_manage_classes IS NOT NULL OR can_manage_students IS NOT NULL;

-- Verificar se a limpeza foi bem-sucedida
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(can_manage_classes) as users_with_custom_class_permission,
    COUNT(can_manage_students) as users_with_custom_student_permission
FROM profiles
GROUP BY role
ORDER BY role;
