-- Agregar campo last_seen_at para tracking de usuarios online
-- Este campo se actualiza cada vez que el usuario entra/sale de la plataforma

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Crear índice para consultas rápidas de usuarios online
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles (is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles (last_seen_at DESC);

-- Comentarios
COMMENT ON COLUMN public.profiles.last_seen_at IS 'Última vez que el usuario estuvo activo en la plataforma';
COMMENT ON COLUMN public.profiles.is_online IS 'Indica si el usuario está actualmente conectado';
