-- TRUNCATE does not fire row/statement DELETE triggers. Route it through the
-- same validated refresh path so an accidental private-table truncate rolls back
-- instead of leaving a stale generated question bank behind.

drop trigger if exists trivia_team_facts_refresh_after_truncate on ball_knower_private.trivia_team_facts;
create trigger trivia_team_facts_refresh_after_truncate
after truncate on ball_knower_private.trivia_team_facts
for each statement execute function ball_knower_private.trivia_team_facts_refresh_trigger();
