-- Cover relationship lookups flagged by the database performance advisor.
create index if not exists bk_friendships_requester_idx on public.ball_knower_friendships(requester_id,status,updated_at desc);
create index if not exists bk_community_messages_author_idx on public.ball_knower_community_messages(author_id,created_at desc);
create index if not exists bk_community_messages_recipient_idx on public.ball_knower_community_messages(recipient_id,created_at desc) where recipient_id is not null;
create index if not exists bk_community_reports_subject_idx on public.ball_knower_community_reports(subject_id,created_at desc);
create index if not exists bk_h2h_winner_idx on public.ball_knower_h2h_matches(winner_id,finished_at desc) where winner_id is not null;
create index if not exists bk_h2h_answers_user_idx on ball_knower_private.h2h_answers(user_id,answered_at desc);
