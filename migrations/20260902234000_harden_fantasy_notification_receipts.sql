-- Notification content and delivery decisions are server-owned. Clients may
-- acknowledge an owner-only in-app row through a narrow authenticated RPC.

create or replace function public.mark_ball_knower_notification_read(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if p_notification_id is null then raise exception 'Notification is required'; end if;

  update public.ball_knower_notifications notification
  set read_at = coalesce(notification.read_at, now())
  where notification.id = p_notification_id
    and notification.auth_user_id = v_auth
    and notification.in_app_visible;
  get diagnostics v_count = row_count;
  return v_count = 1;
end
$function$;

revoke update on table public.ball_knower_notifications from authenticated;
revoke all on function public.mark_ball_knower_notification_read(uuid)
  from public, anon;
grant execute on function public.mark_ball_knower_notification_read(uuid)
  to authenticated;

comment on function public.mark_ball_knower_notification_read(uuid) is
  'Acknowledges one visible notification owned by auth.uid(); notification content and delivery flags remain server-owned.';
