-- The invoker-based service-order transition delegates to this private helper.
-- The private schema is not exposed through the Data API.
grant execute on function private.reserve_quote_parts(uuid, uuid, uuid) to authenticated;

