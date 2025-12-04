-- Tabla para mensajes del profesor a los alumnos
CREATE TABLE IF NOT EXISTS student_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_student_messages_student ON student_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_student_messages_professor ON student_messages(professor_id);
CREATE INDEX IF NOT EXISTS idx_student_messages_created ON student_messages(created_at DESC);

-- Agregar campo is_active a profiles si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- RLS Policies para student_messages
ALTER TABLE student_messages ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (para re-ejecutar el script)
DROP POLICY IF EXISTS "Students can view their messages" ON student_messages;
DROP POLICY IF EXISTS "Professors can send messages" ON student_messages;
DROP POLICY IF EXISTS "Professors can view sent messages" ON student_messages;
DROP POLICY IF EXISTS "Students can mark as read" ON student_messages;

-- Students can read their own messages
CREATE POLICY "Students can view their messages"
  ON student_messages FOR SELECT
  USING (auth.uid() = student_id);

-- Professors can insert and view messages  
CREATE POLICY "Professors can send messages"
  ON student_messages FOR INSERT
  WITH CHECK (auth.uid() = professor_id);

CREATE POLICY "Professors can view sent messages"
  ON student_messages FOR SELECT
  USING (auth.uid() = professor_id);

-- Students can mark as read
CREATE POLICY "Students can mark as read"
  ON student_messages FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
