create or replace function public.create_order_with_appointment(
  p_organization_id uuid,
  p_unit_id uuid,
  p_client_id uuid,
  p_device_id uuid,
  p_mode public.service_order_mode,
  p_issue text,
  p_start_at timestamptz,
  p_duration_minutes integer,
  p_address text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_order public.service_orders%rowtype;
  created_appointment public.appointments%rowtype;
  appointment_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '28000';
  end if;
  if p_start_at <= now() or p_duration_minutes not in (15, 30, 45, 60, 90, 120, 180, 240) then
    raise exception 'Informe uma data futura e uma duração válida.' using errcode = '22023';
  end if;

  insert into public.service_orders (
    organization_id, unit_id, client_id, device_id, number, mode, issue, created_by
  ) values (
    p_organization_id, p_unit_id, p_client_id, p_device_id, '', p_mode, p_issue, auth.uid()
  ) returning * into created_order;

  appointment_title := case p_mode
    when 'Remoto' then 'Atendimento remoto'
    when 'Domicílio' then 'Visita ao cliente'
    else 'Atendimento no balcão'
  end;
  insert into public.appointments (
    organization_id, unit_id, service_order_id, client_id, assigned_to,
    mode, title, start_at, end_at, address, created_by, updated_by
  ) values (
    p_organization_id, p_unit_id, created_order.id, p_client_id, auth.uid(),
    p_mode, appointment_title, p_start_at,
    p_start_at + make_interval(mins => p_duration_minutes), nullif(btrim(p_address), ''),
    auth.uid(), auth.uid()
  ) returning * into created_appointment;

  return jsonb_build_object('id', created_order.id, 'number', created_order.number,
    'appointmentId', created_appointment.id);
end;
$$;

revoke all on function public.create_order_with_appointment(uuid, uuid, uuid, uuid, public.service_order_mode, text, timestamptz, integer, text) from public;
grant execute on function public.create_order_with_appointment(uuid, uuid, uuid, uuid, public.service_order_mode, text, timestamptz, integer, text) to authenticated;
