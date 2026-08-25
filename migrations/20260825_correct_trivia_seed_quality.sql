-- Correct reviewed seed-quality issues without deleting historical attempts.
-- Generated questions already distribute answer positions; rotate the smaller manual
-- bank deterministically so no tier can be farmed by always choosing one option.

-- A standard inside-zone read leaves the backside/read-side edge defender unblocked.
update ball_knower_private.trivia_questions
set question = 'On a basic inside-zone read, which defender is commonly left unblocked for the quarterback to read?',
    answers = '["Backside/read-side edge defender","Free safety","Nose tackle","Boundary corner"]'::jsonb,
    correct_index = 0,
    explanation = 'On a basic inside-zone read, the quarterback commonly reads the backside/read-side edge defender while the line blocks zone away from him.'
where question_key = 'pro_zone_read_edge';

-- Keep the original 336-yard record question as the canonical identity. Deactivate
-- the later duplicate rather than deleting it so existing attempts stay referentially valid.
update ball_knower_private.trivia_questions
set active = false
where question_key = 'hof_flipper_336';

-- Rotate answer arrays while preserving the correct answer. The stable key-derived
-- offset makes a fresh database deterministic and distributes correct positions.
with target as (
  select id,
         (abs(hashtextextended(question_key, 20260825)) % 4)::integer as shift
  from ball_knower_private.trivia_questions
  where question_key not like 'gen\_%' escape '\'
    and active
)
update ball_knower_private.trivia_questions q
set answers = jsonb_build_array(
      q.answers -> target.shift,
      q.answers -> ((target.shift + 1) % 4),
      q.answers -> ((target.shift + 2) % 4),
      q.answers -> ((target.shift + 3) % 4)
    ),
    correct_index = ((q.correct_index - target.shift + 4) % 4)::smallint
from target
where q.id = target.id;
