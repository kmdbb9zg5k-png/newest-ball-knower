-- Bootstrap the server-only schema before any protected trivia or Draft Order Game tables.
-- Browser roles must never receive direct access; SECURITY DEFINER functions expose only
-- the small validated interfaces they need.

create schema if not exists ball_knower_private;
alter schema ball_knower_private owner to postgres;

revoke all on schema ball_knower_private from public, anon, authenticated;
grant usage on schema ball_knower_private to postgres, service_role;
