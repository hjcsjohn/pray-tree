-- 기도나무 초기 스키마 (Supabase SQL Editor에서 한 번 실행)
-- 개인정보 보호를 위해 RLS를 켜고, 교사는 본인에게 배정된 학생만 접근하도록 제한합니다.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'teacher' check (role in ('admin','teacher')),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  full_name text not null,
  grade text not null default '미지정',
  emoji text not null default '🧒🏻',
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,
  body text not null default '',
  status text not null default '진행 중' check (status in ('진행 중','응답 완료')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_responses (
  id uuid primary key default gen_random_uuid(),
  prayer_id uuid not null references public.prayer_requests(id) on delete cascade,
  body text not null,
  response_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_days (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  prayer_date date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(student_id, prayer_date)
);

create index if not exists students_teacher_id_idx on public.students(teacher_id);
create index if not exists prayer_requests_student_id_idx on public.prayer_requests(student_id);
create index if not exists prayer_responses_prayer_id_idx on public.prayer_responses(prayer_id);
create index if not exists prayer_days_student_id_idx on public.prayer_days(student_id);

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.can_access_student(target_student uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student
      and (s.teacher_id = auth.uid() or public.current_role() = 'admin')
  )
$$;

create or replace function public.can_access_prayer(target_prayer uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.prayer_requests p
    join public.students s on s.id = p.student_id
    where p.id = target_prayer
      and (s.teacher_id = auth.uid() or public.current_role() = 'admin')
  )
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_responses enable row level security;
alter table public.prayer_days enable row level security;

drop policy if exists "profiles read self and admin" on public.profiles;
create policy "profiles read self and admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update to authenticated
using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "student read assigned or admin" on public.students;
create policy "student read assigned or admin" on public.students for select to authenticated
using (teacher_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "student insert assigned or admin" on public.students;
create policy "student insert assigned or admin" on public.students for insert to authenticated
with check (teacher_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "student update assigned or admin" on public.students;
create policy "student update assigned or admin" on public.students for update to authenticated
using (teacher_id = auth.uid() or public.current_role() = 'admin')
with check (teacher_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "student delete admin" on public.students;
create policy "student delete admin" on public.students for delete to authenticated
using (public.current_role() = 'admin');

drop policy if exists "prayer read assigned or admin" on public.prayer_requests;
create policy "prayer read assigned or admin" on public.prayer_requests for select to authenticated
using (public.can_access_student(student_id));

drop policy if exists "prayer insert assigned or admin" on public.prayer_requests;
create policy "prayer insert assigned or admin" on public.prayer_requests for insert to authenticated
with check (public.can_access_student(student_id) and created_by = auth.uid());

drop policy if exists "prayer update assigned or admin" on public.prayer_requests;
create policy "prayer update assigned or admin" on public.prayer_requests for update to authenticated
using (public.can_access_student(student_id))
with check (public.can_access_student(student_id));

drop policy if exists "prayer delete admin" on public.prayer_requests;
create policy "prayer delete admin" on public.prayer_requests for delete to authenticated
using (public.current_role() = 'admin');

drop policy if exists "response read assigned or admin" on public.prayer_responses;
create policy "response read assigned or admin" on public.prayer_responses for select to authenticated
using (public.can_access_prayer(prayer_id));

drop policy if exists "response insert assigned or admin" on public.prayer_responses;
create policy "response insert assigned or admin" on public.prayer_responses for insert to authenticated
with check (public.can_access_prayer(prayer_id) and created_by = auth.uid());

drop policy if exists "response delete admin" on public.prayer_responses;
create policy "response delete admin" on public.prayer_responses for delete to authenticated
using (public.current_role() = 'admin');

drop policy if exists "prayer day read assigned or admin" on public.prayer_days;
create policy "prayer day read assigned or admin" on public.prayer_days for select to authenticated
using (public.can_access_student(student_id));

drop policy if exists "prayer day insert assigned or admin" on public.prayer_days;
create policy "prayer day insert assigned or admin" on public.prayer_days for insert to authenticated
with check (public.can_access_student(student_id) and created_by = auth.uid());

drop policy if exists "prayer day update assigned or admin" on public.prayer_days;
create policy "prayer day update assigned or admin" on public.prayer_days for update to authenticated
using (public.can_access_student(student_id))
with check (public.can_access_student(student_id) and created_by = auth.uid());

-- 신규 가입 사용자의 프로필 자동 생성. 기본 역할은 항상 teacher.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'teacher')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 첫 관리자 계정을 만든 후 아래 UPDATE를 실행하세요.
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = '관리자이메일');
