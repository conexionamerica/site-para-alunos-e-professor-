
-- Función para vincular un profesor a un estudiante saltándose RLS (Security Definer)
CREATE OR REPLACE FUNCTION admin_link_professor(
    p_student_id UUID,
    p_professor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Actualizar el perfil del estudiante
    UPDATE public.profiles
    SET assigned_professor_id = p_professor_id
    WHERE id = p_student_id;

    -- Obtener datos para retornar
    SELECT jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'professor_id', p_professor_id
    ) INTO v_result;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
