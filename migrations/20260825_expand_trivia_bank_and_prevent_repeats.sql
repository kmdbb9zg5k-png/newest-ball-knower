-- Expand the secure trivia bank and avoid serving recently seen questions.
-- Questions remain private; clients receive only the four answer choices.

insert into ball_knower_private.trivia_questions(question_key,tier,question,answers,correct_index,explanation)
values
-- ROOKIE
('rookie_td_points','ROOKIE','How many points is a touchdown worth before the extra point?','["3","6","7","8"]'::jsonb,1,'A touchdown is worth six points before the try.'),
('rookie_first_down_yards','ROOKIE','How many yards does an offense normally need to gain for a new first down?','["5","8","10","15"]'::jsonb,2,'An offense normally needs ten yards for a new set of downs.'),
('rookie_players_field','ROOKIE','How many players may one NFL team have on the field during a play?','["10","11","12","13"]'::jsonb,1,'Each team may have eleven players on the field.'),
('rookie_center_snap','ROOKIE','Which position normally snaps the ball to the quarterback?','["Center","Guard","Tight end","Fullback"]'::jsonb,0,'The center snaps the football to begin the play.'),
('rookie_fg_points','ROOKIE','How many points is a successful field goal worth?','["1","2","3","6"]'::jsonb,2,'A successful field goal is worth three points.'),
('rookie_safety_points','ROOKIE','How many points is a safety worth?','["1","2","3","6"]'::jsonb,1,'A safety scores two points for the defense.'),
('rookie_super_bowl_trophy','ROOKIE','What is the trophy awarded to the Super Bowl champion called?','["Lombardi Trophy","Heisman Trophy","Halas Trophy","Rozelle Trophy"]'::jsonb,0,'The Super Bowl champion receives the Vince Lombardi Trophy.'),
('rookie_qb_abbrev','ROOKIE','What position is abbreviated QB?','["Quarterback","Quick back","Quarter blocker","Quality back"]'::jsonb,0,'QB stands for quarterback.'),
('rookie_wr_job','ROOKIE','Which position is primarily known for catching passes downfield?','["Wide receiver","Center","Defensive tackle","Punter"]'::jsonb,0,'Wide receivers are primary pass-catching targets.'),
('rookie_four_downs','ROOKIE','How many downs does an offense normally have to gain a first down?','["3","4","5","6"]'::jsonb,1,'An offense normally has four downs to gain the required yardage.'),
('rookie_pick_six','ROOKIE','What does “pick-six” mean?','["Six interceptions in a game","An interception returned for a touchdown","A six-yard interception return","The sixth draft pick"]'::jsonb,1,'A pick-six is an interception returned for a touchdown.'),
('rookie_two_point','ROOKIE','How many points is a successful two-point conversion worth?','["1","2","3","6"]'::jsonb,1,'A successful two-point conversion is worth two points.'),

-- PRO
('pro_dime_db','PRO','How many defensive backs are typically on the field in a dime package?','["4","5","6","7"]'::jsonb,2,'A dime package traditionally uses six defensive backs.'),
('pro_kneel_stat','PRO','A quarterback kneel is recorded as what type of play in NFL statistics?','["Incomplete pass","Sack","Rushing attempt","Penalty"]'::jsonb,2,'Quarterback kneels are recorded as rushing attempts.'),
('pro_franchise_tag','PRO','What roster mechanism lets a team retain one pending free agent under a one-year tender?','["Franchise tag","Waiver claim","Practice-squad exemption","Compensatory pick"]'::jsonb,0,'The franchise tag can keep a pending free agent under a one-year tender.'),
('pro_red_zone','PRO','The red zone generally refers to the area inside which yard line?','["10-yard line","20-yard line","25-yard line","30-yard line"]'::jsonb,1,'The red zone is commonly defined as the area from the opponent’s 20-yard line to the goal line.'),
('pro_nickel_db','PRO','How many defensive backs are typically used in a nickel package?','["4","5","6","7"]'::jsonb,1,'Nickel defense traditionally uses five defensive backs.'),
('pro_touchback_25','PRO','On a standard NFL kickoff touchback under the long-standing pre-2024 rule, the ball was placed at which yard line?','["20","25","30","35"]'::jsonb,1,'For many recent seasons before the dynamic kickoff change, kickoff touchbacks were placed at the 25-yard line.'),
('pro_play_action','PRO','What is the main purpose of play-action passing?','["Fake a run to influence defenders","Stop the clock","Create an automatic first down","Change possession"]'::jsonb,0,'Play action uses a run fake to influence defenders before the pass.'),
('pro_hard_count','PRO','Why does a quarterback use a hard count?','["To draw the defense offside or reveal movement","To end the quarter","To call a timeout automatically","To change the score"]'::jsonb,0,'A hard count can induce an offside jump or expose defensive intentions.'),
('pro_sack_definition','PRO','A sack is credited when what happens?','["A runner is tackled for any loss","The quarterback is tackled behind the line on a passing play","A punt is blocked","A pass is intercepted"]'::jsonb,1,'A sack occurs when the passer is tackled behind the line before completing the pass play.'),
('pro_on_side_kick','PRO','What is the main purpose of an onside kick?','["Gain field position only","Give the opponent a touchback","Try to retain possession after scoring","Avoid a kickoff penalty"]'::jsonb,2,'An onside kick is designed to give the kicking team a chance to recover and retain possession.'),
('pro_cover_two','PRO','In a traditional Cover 2 shell, how many deep safeties split the field?','["1","2","3","4"]'::jsonb,1,'Traditional Cover 2 divides the deep field between two safeties.'),
('pro_zone_read_edge','PRO','On a basic zone-read concept, which defender is commonly left unblocked for the quarterback to read?','["Play-side edge defender","Free safety","Nose tackle","Boundary corner"]'::jsonb,0,'The quarterback commonly reads an edge defender to decide whether to give or keep.'),

-- ALL-PRO
('allpro_man_coverage','ALL-PRO','What coverage family assigns defenders primarily to specific eligible receivers rather than zones?','["Man coverage","Cover 3 zone","Prevent zone","Tampa 2"]'::jsonb,0,'Man coverage gives defenders primary responsibility for specific receivers.'),
('allpro_levels','ALL-PRO','Which passing concept uses in-breaking routes at different depths to stretch zone coverage?','["Levels","Mesh","Four verticals","Fade-out"]'::jsonb,0,'Levels stresses zone defenders with routes crossing at different depths.'),
('allpro_mesh','ALL-PRO','Which concept is best known for two shallow crossing routes creating traffic against man coverage?','["Mesh","Smash","Flood","Curl-flat"]'::jsonb,0,'Mesh uses intersecting shallow crossers to stress man coverage.'),
('allpro_smash','ALL-PRO','Which two-route combination traditionally defines the Smash concept?','["Hitch and corner","Slant and flat","Post and dig","Go and screen"]'::jsonb,0,'Smash commonly pairs a short hitch with a corner route.'),
('allpro_flood','ALL-PRO','What does a Flood concept generally try to do to a zone defense?','["Put multiple receivers at different depths on one side","Send every receiver vertically","Use only interior runs","Keep seven blockers in"]'::jsonb,0,'Flood overloads one side of a zone with routes at multiple depths.'),
('allpro_rpo','ALL-PRO','What does RPO stand for?','["Run-pass option","Read-protection offense","Route-pass order","Run-punt option"]'::jsonb,0,'RPO stands for run-pass option.'),
('allpro_half_slide','ALL-PRO','What does half-slide pass protection commonly combine?','["Man protection on one side and a zone-style slide on the other","Two screen passes","Only double teams","A seven-man blitz"]'::jsonb,0,'Half-slide protection mixes man assignments with a slide side.'),
('allpro_spy','ALL-PRO','What is the job of a quarterback spy on defense?','["Track the quarterback, especially as a runner","Double-team the center","Cover only the running back","Rush from the blind side every play"]'::jsonb,0,'A spy mirrors the quarterback and helps contain scrambles.'),
('allpro_force_defender','ALL-PRO','In run defense, what is the force defender generally responsible for?','["Setting the edge and turning the run back inside","Covering the deep middle","Snapping the ball","Calling offensive protections"]'::jsonb,0,'The force player is responsible for keeping outside runs from escaping the edge.'),
('allpro_box_count','ALL-PRO','When coaches discuss the defensive “box,” what area are they usually counting defenders in?','["Near the line of scrimmage around the tackle box","Only the end zone","Only the secondary","The sideline bench area"]'::jsonb,0,'The box refers to defenders aligned near the line of scrimmage around the tackle area.'),
('allpro_hot_route','ALL-PRO','A hot route is most often used in response to what?','["Pressure or a blitz look","A kickoff return","A kneel-down","A punt formation"]'::jsonb,0,'Hot routes give the quarterback a quick answer against pressure.'),
('allpro_leverage','ALL-PRO','In coverage terminology, “inside leverage” means a defender is aligned primarily to protect which side of a receiver?','["Inside","Outside","Deep only","Behind the quarterback"]'::jsonb,0,'Inside leverage positions the defender to discourage or control inside releases and routes.'),

-- HALL OF FAME
('hof_perfect_1972','HALL OF FAME','Which NFL team completed the only perfect season including the Super Bowl in the modern era?','["1972 Miami Dolphins","1985 Chicago Bears","2007 New England Patriots","1991 Washington"]'::jsonb,0,'The 1972 Miami Dolphins finished unbeaten and won Super Bowl VII.'),
('hof_four_sb_bills','HALL OF FAME','Which team reached four consecutive Super Bowls from the 1990 through 1993 seasons?','["Buffalo Bills","Dallas Cowboys","San Francisco 49ers","Denver Broncos"]'::jsonb,0,'Buffalo reached four straight Super Bowls following the 1990, 1991, 1992 and 1993 seasons.'),
('hof_first_super_bowl','HALL OF FAME','Which franchise won the first Super Bowl?','["Green Bay Packers","Kansas City Chiefs","Dallas Cowboys","Oakland Raiders"]'::jsonb,0,'Green Bay defeated Kansas City in the first AFL-NFL World Championship Game, later called Super Bowl I.'),
('hof_1985_bears','HALL OF FAME','Which team is famous for the dominant 1985 defense that won Super Bowl XX?','["Chicago Bears","New York Giants","Washington","Miami Dolphins"]'::jsonb,0,'The 1985 Chicago Bears won Super Bowl XX behind one of the league’s most famous defenses.'),
('hof_brown_four_titles','HALL OF FAME','Which coach won four Super Bowls with the Pittsburgh Steelers in the 1970s?','["Chuck Noll","Bill Walsh","Tom Landry","Don Shula"]'::jsonb,0,'Chuck Noll coached Pittsburgh to four Super Bowl victories.'),
('hof_lombardi_packers','HALL OF FAME','Which coach led Green Bay to victories in the first two Super Bowls?','["Vince Lombardi","George Halas","Paul Brown","Tom Landry"]'::jsonb,0,'Vince Lombardi coached the Packers to wins in Super Bowls I and II.'),
('hof_montana_four','HALL OF FAME','Which quarterback won four Super Bowls with the San Francisco 49ers without losing one?','["Joe Montana","Steve Young","John Elway","Dan Marino"]'::jsonb,0,'Joe Montana went 4-0 as a starting quarterback in Super Bowls with San Francisco.'),
('hof_emmitt_rushing','HALL OF FAME','Who is the NFL’s all-time career rushing yards leader?','["Emmitt Smith","Walter Payton","Barry Sanders","Frank Gore"]'::jsonb,0,'Emmitt Smith finished his career as the NFL’s all-time rushing yards leader.'),
('hof_rice_receiving','HALL OF FAME','Who is the NFL’s all-time career receiving yards leader?','["Jerry Rice","Larry Fitzgerald","Randy Moss","Terrell Owens"]'::jsonb,0,'Jerry Rice holds the NFL career receiving yards record.'),
('hof_wishbone','HALL OF FAME','Which formation traditionally places three running backs in a wishbone shape behind the quarterback?','["Wishbone","Pistol","Empty","Single wing spread"]'::jsonb,0,'The wishbone uses a fullback and two halfbacks behind the quarterback.'),
('hof_no_three_sb_mvp','HALL OF FAME','Who is the only player to win Super Bowl MVP three consecutive times?','["Joe Montana","Tom Brady","Terry Bradshaw","No player has"]'::jsonb,3,'No player has won Super Bowl MVP in three consecutive Super Bowls.'),
('hof_flipper_336','HALL OF FAME','Who set the NFL single-game receiving yardage record with 336 yards in 1989?','["Flipper Anderson","Jerry Rice","Calvin Johnson","Steve Largent"]'::jsonb,0,'Flipper Anderson recorded 336 receiving yards for the Rams in 1989.')
on conflict(question_key) do update
set tier=excluded.tier,question=excluded.question,answers=excluded.answers,correct_index=excluded.correct_index,explanation=excluded.explanation,active=true;

-- Never repeat one of a user's 50 most recently served questions when another
-- active question exists in that tier. This prevents immediate and session-level repeats.
create or replace function public.get_ball_knower_trivia_question(p_tier text)
returns table(attempt_id bigint, question_id bigint, tier text, question text, answers jsonb)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_question ball_knower_private.trivia_questions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  select q.* into v_question
  from ball_knower_private.trivia_questions q
  where q.active
    and q.tier = p_tier
    and not exists (
      select 1
      from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        where a.user_id = v_user
        order by a.created_at desc
        limit 50
      ) recent
      where recent.question_id = q.id
    )
  order by random()
  limit 1;

  -- Once the user has exhausted the active tier pool, allow older questions again,
  -- while still excluding the immediately previous question when possible.
  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier = p_tier
      and q.id is distinct from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        where a.user_id = v_user
        order by a.created_at desc
        limit 1
      )
    order by random()
    limit 1;
  end if;

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier = p_tier
    order by random()
    limit 1;
  end if;

  if v_question.id is null then raise exception 'No active question available'; end if;
  insert into ball_knower_private.trivia_attempts(user_id,question_id)
    values(v_user,v_question.id) returning id into attempt_id;
  question_id := v_question.id;
  tier := v_question.tier;
  question := v_question.question;
  answers := v_question.answers;
  return next;
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;
