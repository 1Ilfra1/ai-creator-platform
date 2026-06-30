alter table public.creators
add column if not exists is_demo boolean not null default false;
