-- Make the newly exposed cancel RPC available immediately to PostgREST.
notify pgrst, 'reload schema';
