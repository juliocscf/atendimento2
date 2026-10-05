begin;

alter function public.set_third_party_pickup_enabled(uuid, boolean)
security invoker;

commit;
