create or replace function private.next_device_code(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  bytes bytea;
  position integer;
  attempt integer;
begin
  for attempt in 1..40 loop
    bytes := extensions.gen_random_bytes(4);
    candidate := '';
    for position in 0..3 loop
      candidate := candidate || substr(alphabet, (get_byte(bytes, position) % length(alphabet)) + 1, 1);
    end loop;

    if not exists (
      select 1 from public.devices
      where organization_id = target_organization_id and code = candidate
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'Could not generate a unique device code for organization %', target_organization_id
    using errcode = 'unique_violation';
end;
$$;

