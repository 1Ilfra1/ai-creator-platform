create or replace view public.public_creators as
select
  id,
  username,
  display_name,
  tagline,
  bio,
  tags,
  topics,
  profile_image,
  banner_image,
  intro_audio,
  is_active,
  is_published,
  is_demo
from public.creators
where is_active = true
  and is_published = true;

grant select on public.public_creators to anon, authenticated;
