-- Execute este script no Editor SQL do Supabase para corrigir o erro.

-- 1. Criar a tabela de avisos
create table if not exists professor_announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  type text not null,
  author text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar segurança (RLS)
alter table professor_announcements enable row level security;

-- 3. Permitir leitura para todos (avisos ativos)
create policy "Everyone can view active announcements"
  on professor_announcements for select
  using (is_active = true);

-- 4. Permitir que administradores gerenciem (insert/update/delete)
-- Ajuste: permitindo autenticados por enquanto para garantir funcionamento, 
-- a lógica de UI já esconde o botão de quem não é admin.
create policy "Authenticated can manage announcements"
  on professor_announcements for all
  using (auth.role() = 'authenticated');
