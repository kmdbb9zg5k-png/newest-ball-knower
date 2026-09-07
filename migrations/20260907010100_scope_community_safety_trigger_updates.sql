-- A reply_to foreign key is set NULL when its parent message is deleted.
-- That metadata-only update must not be treated as another author's attempt
-- to send a message. Preserve safety enforcement for content/identity changes.
drop trigger bk_league_message_safety on public.ball_knower_league_messages;
create trigger bk_league_message_safety
  before insert or update of body, auth_user_id, league_id
  on public.ball_knower_league_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();

drop trigger bk_dm_message_safety on public.ball_knower_dm_messages;
create trigger bk_dm_message_safety
  before insert or update of body, sender_auth_id, thread_id
  on public.ball_knower_dm_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();

drop trigger bk_trade_message_safety on public.ball_knower_trade_messages;
create trigger bk_trade_message_safety
  before insert or update of body, sender_auth_id, trade_id
  on public.ball_knower_trade_messages
  for each row execute function ball_knower_private.enforce_community_message_safety();
