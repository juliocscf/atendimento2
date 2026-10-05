begin;

alter function private.request_pickup_authorization(text, text, text, text)
set search_path = pg_catalog, extensions;

alter function private.verify_pickup_authorization(text, text)
set search_path = pg_catalog, extensions;

alter function private.collect_pickup_authorization(uuid, text)
set search_path = pg_catalog, extensions;

commit;
