-- Expose only the guarded private cancellation routine to signed-in users.
grant execute on function private.cancel_product_sale(uuid,uuid,uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
