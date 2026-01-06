-- Adicionar coluna de link de reunião ao perfil
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- Comentário para documentação
COMMENT ON COLUMN profiles.meeting_link IS 'Link individual do Google Meet ou Zoom do professor';
