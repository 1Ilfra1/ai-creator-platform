create or replace function public.enforce_creator_demo_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_trusted_context boolean;
begin
  is_trusted_context :=
    current_setting('app.admin_creator_approval', true) = 'true'
    or auth.role() = 'service_role';

  if tg_op = 'INSERT' then
    if not is_trusted_context then
      new.is_demo := false;
    end if;

    return new;
  end if;

  if new.is_demo is distinct from old.is_demo then
    if not is_trusted_context then
      raise exception 'Creators cannot change demo status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_creator_demo_flag_before_write on public.creators;

create trigger enforce_creator_demo_flag_before_write
before insert or update on public.creators
for each row
execute function public.enforce_creator_demo_flag();

revoke execute on function public.enforce_creator_demo_flag()
from public;

revoke insert (is_demo), update (is_demo)
on public.creators
from authenticated;
