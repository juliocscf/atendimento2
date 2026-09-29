create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null,
  event_type text not null check (event_type in ('created', 'status_changed', 'checked_in', 'checked_out')),
  from_status public.appointment_status,
  to_status public.appointment_status,
  description text not null check (char_length(btrim(description)) between 2 and 240),
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, appointment_id) references public.appointments(organization_id, id) on delete cascade
);

create index if not exists appointment_events_lookup_idx on public.appointment_events (organization_id, appointment_id, created_at desc);

create or replace function private.record_appointment_event()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_events (organization_id, appointment_id, event_type, to_status, description, actor_id)
    values (new.organization_id, new.id, 'created', new.status, 'Compromisso criado', new.created_by);
  elsif old.status is distinct from new.status then
    insert into public.appointment_events (organization_id, appointment_id, event_type, from_status, to_status, description, actor_id)
    values (new.organization_id, new.id, 'status_changed', old.status, new.status, 'Status alterado para ' || new.status::text, new.updated_by);
  end if;
  elsif old.checked_in_at is null and new.checked_in_at is not null then
    insert into public.appointment_events (organization_id, appointment_id, event_type, description, actor_id)
    values (new.organization_id, new.id, 'checked_in', 'Chegada registrada', new.updated_by);
  elsif old.checked_out_at is null and new.checked_out_at is not null then
    insert into public.appointment_events (organization_id, appointment_id, event_type, description, actor_id)
    values (new.organization_id, new.id, 'checked_out', 'Saída registrada', new.updated_by);
  end if;
  return new;
end;
$$;
revoke all on function private.record_appointment_event() from public;
create trigger appointments_record_event after insert or update of status, checked_in_at, checked_out_at on public.appointments for each row execute function private.record_appointment_event();

alter table public.appointment_events enable row level security;
create policy "members can view appointment events" on public.appointment_events for select to authenticated using (private.is_active_member(organization_id, (select auth.uid())));
