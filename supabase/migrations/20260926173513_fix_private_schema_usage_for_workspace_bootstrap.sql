revoke usage on schema private from anon;
grant usage on schema private to authenticated;

revoke all on function private.bootstrap_rivora_workspace_impl(text) from anon;
revoke all on function public.bootstrap_rivora_workspace(text) from anon;

grant execute on function private.bootstrap_rivora_workspace_impl(text) to authenticated;
grant execute on function public.bootstrap_rivora_workspace(text) to authenticated;
