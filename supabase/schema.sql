-- ============================================================
-- מבנה בסיס הנתונים של אתר הקורסים
-- מריצים פעם אחת ב-Supabase: SQL Editor › New query › מדביקים הכול › Run
-- ⚠ לפני ההרצה: להחליף את המייל בשורה האחרונה של הקובץ במייל שלך.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists public.staff (
  email      text primary key check (email = lower(email)),
  role       text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  icon        text not null default '🎓',
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.enrollments (
  course_id  uuid not null references public.courses on delete cascade,
  email      text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  primary key (course_id, email)
);

create table if not exists public.lectures (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses on delete cascade,
  number      int  not null default 1,
  title       text not null,
  summary     text not null default '',
  video_url   text not null default '',
  materials   jsonb not null default '[]'::jsonb,
  slides_path text,
  slides_name text,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  lecture_id   uuid not null unique references public.lectures on delete cascade,
  title        text not null,
  instructions text not null default '',
  due_at       date,
  created_at   timestamptz not null default now()
);

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises on delete cascade,
  email       text not null check (email = lower(email)),
  link        text not null default '',
  answer      text not null default '',
  status      text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_fix')),
  feedback    text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (exercise_id, email)
);

create table if not exists public.lesson_views (
  lecture_id uuid not null references public.lectures on delete cascade,
  email      text not null,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  views      int not null default 1,
  primary key (lecture_id, email)
);

-- ---------- helper functions (who is asking) ----------
create or replace function public.my_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where email = public.my_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where email = public.my_email() and role = 'admin')
$$;

create or replace function public.is_enrolled(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments where course_id = c and email = public.my_email())
$$;

create or replace function public.can_open_lecture(l uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (
    select 1 from public.lectures x where x.id = l and x.published and public.is_enrolled(x.course_id))
$$;

create or replace function public.can_open_exercise(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.exercises x where x.id = e and public.can_open_lecture(x.lecture_id))
$$;

-- students may not grade themselves: status and feedback are set only by staff
create or replace function public.guard_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then
    new.email := public.my_email();
    new.status := 'submitted';
    new.feedback := case when tg_op = 'UPDATE' then old.feedback else '' end;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists guard_submission on public.submissions;
create trigger guard_submission before insert or update on public.submissions
  for each row execute function public.guard_submission();

-- a student opened a lecture page
create or replace function public.record_view(l uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_email() = '' or not public.can_open_lecture(l) then return; end if;
  insert into public.lesson_views (lecture_id, email) values (l, public.my_email())
  on conflict (lecture_id, email) do update set last_seen = now(), views = public.lesson_views.views + 1;
end $$;
grant execute on function public.record_view(uuid) to authenticated;

-- ---------- row level security ----------
alter table public.staff        enable row level security;
alter table public.courses      enable row level security;
alter table public.enrollments  enable row level security;
alter table public.lectures     enable row level security;
alter table public.exercises    enable row level security;
alter table public.submissions  enable row level security;
alter table public.lesson_views enable row level security;

drop policy if exists staff_read  on public.staff;
drop policy if exists staff_write on public.staff;
create policy staff_read  on public.staff for select to authenticated using (email = public.my_email() or public.is_staff());
create policy staff_write on public.staff for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists courses_read  on public.courses;
drop policy if exists courses_write on public.courses;
create policy courses_read  on public.courses for select to authenticated using (public.is_staff() or public.is_enrolled(id));
create policy courses_write on public.courses for all    to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists enroll_read  on public.enrollments;
drop policy if exists enroll_write on public.enrollments;
create policy enroll_read  on public.enrollments for select to authenticated using (email = public.my_email() or public.is_staff());
create policy enroll_write on public.enrollments for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists lectures_read  on public.lectures;
drop policy if exists lectures_write on public.lectures;
create policy lectures_read  on public.lectures for select to authenticated using (public.can_open_lecture(id));
create policy lectures_write on public.lectures for all    to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists exercises_read  on public.exercises;
drop policy if exists exercises_write on public.exercises;
create policy exercises_read  on public.exercises for select to authenticated using (public.can_open_lecture(lecture_id));
create policy exercises_write on public.exercises for all    to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists subs_read       on public.submissions;
drop policy if exists subs_insert_own on public.submissions;
drop policy if exists subs_update_own on public.submissions;
drop policy if exists subs_staff      on public.submissions;
create policy subs_read       on public.submissions for select to authenticated using (email = public.my_email() or public.is_staff());
create policy subs_insert_own on public.submissions for insert to authenticated with check (email = public.my_email() and public.can_open_exercise(exercise_id));
create policy subs_update_own on public.submissions for update to authenticated using (email = public.my_email() and status <> 'reviewed') with check (email = public.my_email());
create policy subs_staff      on public.submissions for all    to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists views_read on public.lesson_views;
create policy views_read on public.lesson_views for select to authenticated using (email = public.my_email() or public.is_staff());

-- ---------- table access for signed-in users (the rules above still decide what each one sees) ----------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- ---------- storage for the decks ----------
insert into storage.buckets (id, name, public) values ('slides', 'slides', false)
on conflict (id) do nothing;

drop policy if exists slides_read  on storage.objects;
drop policy if exists slides_write on storage.objects;
drop policy if exists slides_edit  on storage.objects;
drop policy if exists slides_del   on storage.objects;
-- path is "<lecture id>/deck.html"
create policy slides_read  on storage.objects for select to authenticated
  using (bucket_id = 'slides' and public.can_open_lecture(((storage.foldername(name))[1])::uuid));
create policy slides_write on storage.objects for insert to authenticated with check (bucket_id = 'slides' and public.is_staff());
create policy slides_edit  on storage.objects for update to authenticated using (bucket_id = 'slides' and public.is_staff());
create policy slides_del   on storage.objects for delete to authenticated using (bucket_id = 'slides' and public.is_staff());

-- ---------- the first admin: YOU ----------
-- ⚠ להחליף את המייל למטה במייל ה-Google שלך (באותיות קטנות), ואז להריץ.
insert into public.staff (email, role) values ('your.email@gmail.com', 'admin')
on conflict (email) do update set role = 'admin';
