-- Create table for professor announcements
create table if not exists professor_announcements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  type text not null, -- 'Manutenção', 'Pedagógico', 'Geral', etc.
  author text, -- Name of the creator (e.g. 'Administração')
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table professor_announcements enable row level security;

-- Policy: Everyone can read active announcements
create policy "Everyone can view active announcements"
  on professor_announcements for select
  using (is_active = true);

-- Policy: Admins can do everything (insert, update, delete)
-- Assuming admin/superadmin roles are handled via app logic or a specific admin role in auth.users
-- For simplicity in this context, we'll allow authenticated users to insert if they are admins (checked in app), 
-- but ideally this should be stricter. 
-- Relying on frontend 'isSuperadmin' check for UI, but for RLS lets allow all authenticated for now
-- since the app handles role checks. Secure approach would be checking public.profiles.role
create policy "Admins can manage announcements"
  on professor_announcements for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'superadmin')
    )
  );
