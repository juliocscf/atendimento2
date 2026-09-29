begin;

-- O portal usa token temporário e não exige sessão. Usuários autenticados
-- não precisam executar diretamente estas funções SECURITY DEFINER.
revoke execute on function public.get_quote_portal(text) from authenticated;
revoke execute on function public.approve_quote_portal(text) from authenticated;

commit;
