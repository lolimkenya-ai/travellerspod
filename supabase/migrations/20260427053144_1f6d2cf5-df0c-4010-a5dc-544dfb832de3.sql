-- Make sure client-callable RPCs are still callable by signed-in users.
revoke execute on function public.claim_first_admin() from public, anon;
grant execute on function public.claim_first_admin() to authenticated;

revoke execute on function public.ensure_super_admin() from public, anon;
grant execute on function public.ensure_super_admin() to authenticated;

revoke execute on function public.decide_verification(uuid, text, text) from public, anon;
grant execute on function public.decide_verification(uuid, text, text) to authenticated;

revoke execute on function public.flag_document(uuid, boolean, text) from public, anon;
grant execute on function public.flag_document(uuid, boolean, text) to authenticated;

revoke execute on function public.set_user_danger(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_danger(uuid, boolean, text) to authenticated;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke execute on function public.start_dm(uuid, boolean) from public, anon;
grant execute on function public.start_dm(uuid, boolean) to authenticated;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;