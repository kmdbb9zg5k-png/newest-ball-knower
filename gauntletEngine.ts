export type GauntletTier='ROOKIE'|'PRO'|'ALL-PRO'|'HALL OF FAME';
export type GauntletMode='FILM ROOM'|'PREDICTIONS'|'DEBATES'|'SURVIVOR';
export type GauntletScenario={
  id:string;mode:GauntletMode;tier:GauntletTier;family:string;
  context:string;prompt:string;options:string[];correct:number;explanation:string;
};

type Concept={family:string;context:string;prompt:string;correct:string;wrong:[string,string,string];explanation:string};
export const GAUNTLET_TIERS:GauntletTier[]=['ROOKIE','PRO','ALL-PRO','HALL OF FAME'];
export const GAUNTLET_MODES:GauntletMode[]=['FILM ROOM','PREDICTIONS','DEBATES','SURVIVOR'];

const film:Concept[]=[
 ['cover-2-man','Two high safeties stay deep while underneath defenders trail receivers.','What coverage is most likely?','Cover 2 Man',['Cover 0','Cover 3 Buzz','Goal-line bracket'],'Two deep safeties plus trail leverage underneath is the classic Cover 2 Man picture.'],
 ['cover-3','One safety rotates to the deep middle while both corners bail outside.','What coverage did the defense rotate into?','Cover 3',['Cover 2','Cover 0','Quarters'],'Three deep zones are created by the post safety and two outside corners.'],
 ['quarters','Both safeties read the releases of No. 2 and stay responsible for deep quarters.','Name the coverage family.','Quarters',['Tampa 2','Cover 1 Robber','Zero blitz'],'Quarters assigns four defenders to deep fourths with pattern-match rules underneath.'],
 ['tampa-2','The middle linebacker opens and runs deep between two high safeties.','What coverage is the defense playing?','Tampa 2',['Cover 1','Quarters','Cover 0'],'Tampa 2 turns the middle linebacker into the third deep defender.'],
 ['cover-1-robber','A single-high safety stays deep and a second safety cuts crossing routes inside.','What is the likely call?','Cover 1 Robber',['Cover 4','Cover 2 Zone','Prevent'],'The robber sits inside under man coverage while one safety protects the post.'],
 ['zero-blitz','Every eligible receiver has a defender in press alignment and no safety stays deep.','What pressure is showing?','Cover 0 pressure',['Tampa 2','Cover 3 cloud','Quarters'],'No deep help with man leverage signals Cover 0 pressure.'],
 ['mesh-answer','Two shallow crossers create traffic against tight man coverage.','Which concept is the offense using?','Mesh',['Smash','Flood','Dagger'],'Mesh uses intersecting shallow routes to create separation against man.'],
 ['smash-read','A corner route stretches the deep defender while a hitch sits underneath.','Which concept is shown?','Smash',['Levels','Yankee','Stick'],'Smash creates a high-low read on the corner defender.'],
 ['flood-read','Three routes attack short, intermediate and deep areas on one sideline.','Which concept is this?','Flood',['Mesh','Inside zone','Four verticals'],'Flood layers three routes to one side and stretches zone coverage vertically.'],
 ['levels-read','Two in-breaking routes cross the same side at different depths.','Identify the pass concept.','Levels',['Smash','Slant-flat','Screen'],'Levels stresses underneath zones with horizontal in-breakers at separate depths.'],
 ['read-option','The edge crashes hard on the running back and is intentionally unblocked.','What should the quarterback do?','Keep outside the edge',['Hand the ball off','Throw it away','Check to a kneel'],'A crashing read defender gives the quarterback space outside.'],
 ['inside-zone','The line steps together toward the play side and the back reads the first down lineman past the center.','What run scheme is shown?','Inside zone',['Power','Counter','Pin-pull sweep'],'Inside zone uses covered/uncovered rules and a vertical cut by the back.'],
 ['power-run','The backside guard pulls through the play-side gap behind a down block.','Name the run concept.','Power',['Outside zone','Duo','Trap screen'],'Power pairs a puller with a kick-out/down-block structure.'],
 ['counter-run','The back takes an initial step away while a guard and tackle pull to the point of attack.','What run concept is this?','Counter',['Stretch','Sneak','Draw'],'Counter uses backfield misdirection and multiple pullers.'],
 ['duo-run','The line creates vertical double teams with no puller while the back reads the linebacker.','Which run is most likely?','Duo',['Jet sweep','Counter','Speed option'],'Duo is a downhill gap-style run built on double teams and a linebacker read.'],
 ['screen-pressure','The rush wins immediately while linemen release and the back waits behind them.','What did the offense call?','Running back screen',['Seven-step comeback','Quarterback draw','Fade-stop'],'A screen invites pressure before throwing behind it to blockers in space.'],
 ['hot-slant','The defense sends six and leaves the short middle vacant.','What is the fastest answer?','Hot slant',['Slow play-action shot','Seven-step out','Double reverse'],'The hot slant replaces the blitzing defender before the free rusher arrives.'],
 ['half-slide','One side of the line sorts zone threats while the other side has man rules.','What protection is this?','Half-slide protection',['Full sprint-out','Empty protection','Punt shield'],'Half-slide combines man assignments and a zone slide.'],
 ['mike-point','The quarterback points out a linebacker before setting protection.','Why identify the Mike?','Set the protection count',['Choose the primary receiver','Start the play clock','Change the coin toss'],'The Mike declaration establishes how the line and backs count threats.'],
 ['run-fit-spill','The edge wrong-arms a puller and forces the ball wider to pursuit.','What technique is being used?','Spill technique',['Two-gap catch','Cloud corner','Banjo coverage'],'Spill technique attacks the puller inside-out and sends the runner to support.'],
 ['contain-rush','The edge rusher stays level with the quarterback instead of chasing inside.','What responsibility is he protecting?','Quarterback contain',['A-gap plug','Deep middle','Cutback block'],'Disciplined width prevents the quarterback from escaping outside.'],
 ['banjo-call','Two defenders exchange assignments based on how two receivers release.','What adjustment is this?','Banjo call',['Green-dog blitz','Mush rush','Trap block'],'Banjo is a switch call that prevents rub routes from creating free releases.'],
 ['red-zone-bracket','Two defenders play inside/outside leverage on the offense’s top target.','What coverage tool is being used?','Bracket coverage',['Spot drop only','Cover 0 all-out','Run blitz'],'Bracket coverage uses two defenders to remove one dangerous receiver.'],
 ['clock-sideline','The offense has no timeouts and needs a field goal with seconds left.','Which route location matters most?','Sideline completion',['Middle checkdown short of the sticks','Backfield handoff','Quarterback sneak'],'A sideline catch can preserve time by stopping the clock out of bounds.'],
 ['four-minute','The offense leads late and the defense is out of timeouts.','What is the offense’s first priority?','Keep the clock running',['Throw deep every snap','Score as fast as possible','Use intentional penalties'],'Ball security and in-bounds runs shorten the game.'],
].map(([family,context,prompt,correct,wrong,explanation])=>({family,context,prompt,correct,wrong,explanation} as Concept));

const predictions:Concept[]=[
 ['four-minute-close','The favorite leads by four with 2:20 left, owns the ball and the opponent has no timeouts.','What is the most likely result?','The favorite closes the game',['The opponent gets two possessions','Automatic overtime','A mandatory field-goal attempt'],'Clock control makes a closeout the highest-probability result.'],
 ['turnover-regression','An underdog is plus-three in turnovers but still trails entering the fourth quarter.','What is the biggest warning?','Turnover luck may regress',['The underdog cannot score','Possession no longer matters','The favorite must change quarterbacks'],'Turnovers are high-impact and unstable; relying on more is dangerous.'],
 ['weather-under','Heavy rain and strong wind meet two run-first offenses.','Which script is most likely?','Lower scoring with longer drives',['Pass-heavy shootout','A turnover every drive','No field-goal attempts'],'Wind reduces explosive passing while rushing volume keeps the clock moving.'],
 ['pace-over','Two no-huddle offenses rank near the top in plays per drive.','What does that increase?','Possessions and scoring opportunities',['Guaranteed defensive touchdowns','Punt distance only','Coin-toss importance'],'Faster pace generally creates more possessions for both teams.'],
 ['backup-qb','A starting quarterback is ruled out after the market was set.','Which effect deserves the most attention?','Passing efficiency and play volume',['Uniform selection','Stadium capacity','Halftime length'],'Quarterback changes affect dropback quality, conversions and offensive pace.'],
 ['line-injury','Both starting offensive tackles are inactive against an elite edge duo.','What matchup swings most?','Pressure and sack rate',['Kickoff return average','Coin-toss choice','Extra-point distance'],'Backup tackles against elite rushers increase disruption risk.'],
 ['short-week','A veteran team travels after an overtime game on a short week.','Which hidden factor matters?','Recovery disadvantage',['Jersey color','Draft position','Mascot history'],'Travel plus reduced recovery can hurt late-game performance.'],
 ['bye-rest','A well-coached team comes off a bye against an opponent playing its third road game.','Which side has the situational edge?','The rested home team',['The tired road team automatically','Neither; rest never matters','The team with fewer fans'],'Rest and preparation time favor the home side, all else equal.'],
 ['red-zone-gap','One offense moves the ball well but ranks poorly in red-zone touchdowns.','What could create scoring regression?','Finishing drives closer to league average',['Fewer first downs automatically','More punts from the red zone','Longer halftime'],'Stable yardage with unusually poor finishing can rebound.'],
 ['third-down-variance','A defense allows very few third-down conversions despite average early-down play.','What should a predictor question?','Whether third-down success is sustainable',['Whether first downs exist','Whether sacks count','Whether home games matter'],'Extreme third-down rates often regress without strong early-down support.'],
 ['explosive-mismatch','A fast receiver faces a secondary missing both starting safeties.','Which outcome becomes more likely?','Explosive pass plays',['Only quarterback sneaks','Fewer routes run','No play-action'],'Missing deep help magnifies a speed mismatch.'],
 ['run-funnel','A defense is strong outside but light inside and invites rushing attempts.','What opponent tendency should rise?','Interior run volume',['Deep sideline fades only','Punt blocks','Kneel-downs'],'The front structure funnels offenses toward efficient interior runs.'],
 ['pass-funnel','A defense suppresses rushing efficiency but gives up short completions.','What is the likely volume shift?','More quick passes',['More fullback dives only','Fewer snaps','No running back targets'],'Offenses replace inefficient runs with quick-game throws.'],
 ['negative-script','A big underdog falls behind by two scores early.','Which fantasy volume usually rises?','Pass attempts',['Kneel-downs','Field-goal holds','Goal-line defensive snaps'],'Trailing teams typically abandon runs and throw more.'],
 ['positive-script','A large favorite leads throughout the second half.','Which workload is most likely to rise?','Lead running back carries',['Backup punter passes','Opponent kneel-downs','Defensive timeouts'],'Positive script creates clock-killing rushing volume.'],
 ['division-rival','A large favorite meets a familiar division rival for the second time.','What should reduce confidence in a blowout?','Familiarity and matchup-specific adjustments',['The logo colors','The coin itself','Roster numbers'],'Repeat divisional opponents have recent film and tailored counters.'],
 ['travel-altitude','A sea-level team plays at altitude and faces a fast-tempo offense.','Where might the effect show late?','Defensive fatigue',['Opening coin toss','Jersey stitching','Roster size'],'Altitude plus pace stresses conditioning across long drives.'],
 ['field-position','One team has an elite punter and defense but a conservative offense.','What game shape fits best?','Low-possession field-position game',['Constant short fields for both teams','Automatic shootout','No punts'],'Defense and punting can support a slow, territorial game.'],
 ['special-teams-edge','Two evenly matched teams differ sharply in return and kicking efficiency.','What can decide the game?','Hidden yards and field goals',['Only passing yards','Uniform contrast','Timeout announcements'],'Special teams can swing field position and close scoring margins.'],
 ['coach-aggression','One coach consistently goes for fourth downs near midfield.','What does that add?','Possession and scoring volatility',['Guaranteed wins','Fewer offensive snaps','No punts all season'],'Aggressive decisions raise both upside and short-field downside.'],
 ['injury-decoy','A star receiver is active but limited after missing practice.','What is the safest projection adjustment?','Lower efficiency or route participation',['Assume a career game','Set all teammates to zero','Ignore the injury completely'],'Active status alone does not guarantee a full workload.'],
 ['rookie-first-start','A rookie quarterback makes his first road start against a disguise-heavy defense.','What risk rises?','Protection and coverage mistakes',['Extra-point blocks only','Automatic weather delay','Roster penalties'],'Disguise and crowd noise increase processing stress.'],
 ['center-out','An offense loses its starting center before facing a complex pressure team.','What can break down first?','Protection communication',['Receiver speed','Kickoff placement','Sideline temperature'],'Centers organize calls and exchanges against pressure looks.'],
 ['late-weather','A cold front with gusting wind arrives only for the second half.','Which market assumption needs updating?','Full-game passing conditions',['The opening kickoff time','The roster limit','The division alignment'],'A weather shift can change play calling and efficiency after halftime.'],
 ['must-win-myth','A team “must win” but has played inefficiently for a month.','How should motivation be treated?','As context, not proof of improvement',['As a guaranteed victory','As more important than injuries','As a rules change'],'Urgency does not erase matchup quality or recent performance.'],
].map(([family,context,prompt,correct,wrong,explanation])=>({family,context,prompt,correct,wrong,explanation} as Concept));

const debates:Concept[]=[
 ['qb-wins','Claim: Quarterback wins are the best way to rank quarterbacks.','Which response uses the strongest evidence?','Compare efficiency, pressure response and supporting cast alongside wins',['Wins alone settle everything','Highlights are enough','Ignore playoff performance'],'Individual evaluation should include team context without discarding results.'],
 ['rush-yards','Claim: More rushing yards automatically means a better running back.','Which rebuttal is strongest?','Volume, efficiency, receiving and blocking context all matter',['Yards never matter','Only touchdowns count','Use fan voting'],'Total yards can hide workload and efficiency differences.'],
 ['points-defense','Claim: Allowing 30 points proves the defense played badly.','What context should be checked first?','Field position, turnovers and non-offensive scores',['Uniform color','Ticket prices','Pregame music'],'Short fields and opponent defensive scores can distort points allowed.'],
 ['rings-only','Claim: Championships alone determine the greatest player.','Which evidence best challenges it?','Team era, role and individual dominance also matter',['Championships do not exist','Only popularity matters','Use salary alone'],'Titles are meaningful but heavily dependent on organization and teammates.'],
 ['sacks-line','Claim: Every sack is the offensive line’s fault.','What is the best counter?','Track time to throw, coverage and quarterback responsibility',['Sacks never matter','Blame the center every time','Count only home sacks'],'Protection outcomes also depend on reads, receivers and play design.'],
 ['interceptions-qb','Claim: Every interception is equally the quarterback’s fault.','Which evidence is strongest?','Separate bad decisions from drops, tips and end-of-half throws',['Ignore all interceptions','Use passer height','Count wins instead'],'Turnover-worthy play is more informative than the raw total alone.'],
 ['targets-wr','Claim: The receiver with the most targets is automatically the best.','What wins the rebuttal?','Compare target quality, separation, efficiency and role',['Targets never matter','Only blocking matters','Use jersey sales'],'Targets combine ability, scheme and game state.'],
 ['clutch-one-drive','Claim: One winning drive proves a player is clutch.','Which standard is better?','Use a larger sample of high-leverage performance',['One play is always enough','Ignore pressure situations','Use preseason stats'],'Clutch claims need repeatable performance across many high-leverage snaps.'],
 ['draft-grade','Claim: A draft class can be graded immediately.','What is the strongest objection?','Development and opportunity require multiple seasons',['Rookies never play','Draft order is secret','Grades are illegal'],'Immediate grades mostly judge perceived value, not eventual careers.'],
 ['coach-record','Claim: A coach’s record tells the whole story.','Which context belongs in the argument?','Roster quality, injuries, decision quality and improvement',['Hat style','Stadium age only','Coin-toss record only'],'Win-loss results matter but do not isolate coaching impact.'],
 ['defense-yards','Claim: Total yards allowed is the best defensive metric.','What should replace the one-number case?','Efficiency, points, field position and situation',['Mascot ranking','Only tackles','Only possession time'],'Volume-based yardage ignores pace and starting field position.'],
 ['garbage-time','Claim: Late production in a loss is always meaningless.','What is the balanced response?','Evaluate coverage, win probability and play difficulty',['Delete every fourth-quarter stat','All late yards are elite','Score never matters'],'Some late production is discounted, but not every late snap is uncontested.'],
 ['running-qb','Claim: A mobile quarterback cannot win consistently.','Which evidence tests the claim best?','Passing efficiency plus rushing value and availability',['Rushing yards alone','One playoff loss','Player age only'],'Mobility is a tool; overall quarterback play and health determine sustainability.'],
 ['pay-rb','Claim: Teams should never pay a running back.','Which answer is most defensible?','Price, role, age and alternatives determine value',['Every back deserves top pay','Contracts do not matter','Only draft round matters'],'Absolute rules ignore contract structure and player-specific impact.'],
 ['defensive-mvp','Claim: Only quarterbacks should win MVP.','Which rebuttal is strongest?','Compare positional dominance and total value above alternatives',['Quarterbacks are not players','Use sack totals only','Give it to the oldest player'],'A non-quarterback case requires extraordinary dominance relative to position.'],
 ['strength-schedule','Claim: Two identical records prove two teams are equal.','Which evidence breaks the tie best?','Opponent strength, efficiency and injury context',['Alphabetical order','Uniform record','Social followers'],'Records need schedule and performance context.'],
 ['head-to-head','Claim: Head-to-head always settles rankings.','What is the best challenge?','One game is noisy and team matchups differ',['Games never matter','Only point differential matters','Ignore common opponents'],'Head-to-head matters, but it should not erase the broader sample.'],
 ['qb-rating','Claim: Passer rating captures complete quarterback play.','What does it miss?','Sacks, rushing, situation and degree of difficulty',['Completions','Touchdown passes','Attempts'],'Traditional passer rating excludes major parts of quarterback value.'],
 ['fantasy-real','Claim: The better fantasy player is always the better real player.','Which distinction matters?','Fantasy scoring rewards volume differently from on-field value',['Fantasy points are fake','Real players never score','Only defenses count'],'Fantasy rules can elevate usage without measuring complete football performance.'],
 ['trade-winner','Claim: The team receiving the biggest name won the trade.','What should be evaluated instead?','Cost, contract, fit, timeline and opportunity cost',['Name length','Press coverage','Fan reaction only'],'Trade value depends on resources and team direction, not fame alone.'],
 ['prevent-defense','Claim: Prevent defense never works.','Which response is most accurate?','Judge whether it prevents explosive scores at the intended clock state',['It guarantees a stop','It is always man coverage','It removes the play clock'],'Soft coverage trades yards for time and must be judged by win probability.'],
 ['analytics-always','Claim: Analytics always says to go for it.','What corrects the misconception?','Recommendations change with distance, field, time and team strength',['Analytics ignores numbers','It always says punt','It only studies quarterbacks'],'Decision models are conditional, not one universal command.'],
 ['pressure-sacks','Claim: The defense with more sacks always rushed better.','Which evidence adds depth?','Pressure rate, rush time and quarterback movement',['Team colors','Only blitz rate','Home attendance'],'Sacks are outcomes; pressure can be disruptive without finishing.'],
 ['possession-win','Claim: Winning time of possession proves dominance.','What is the best counterexample?','Explosive scoring can win with fewer possession minutes',['Clocks are inaccurate','Possession is not tracked','Every drive is equal'],'Time of possession describes style more than efficiency.'],
 ['close-record','Claim: A great one-score record proves elite clutch ability.','What should be tested?','Whether late-game success persists across seasons',['Only coin tosses','Jersey sales','Draft grades'],'Close-game records contain skill and randomness and often regress.'],
].map(([family,context,prompt,correct,wrong,explanation])=>({family,context,prompt,correct,wrong,explanation} as Concept));

const survivor:Concept[]=[
 ['backup-home','PHI is home against a backup quarterback; KC travels to a division rival; BUF is on a short week.','Pick the safest survivor side.','PHI',['KC','BUF','Pass the week'],'Home field plus the opponent quarterback downgrade creates the cleanest profile.'],
 ['large-home','BAL is a large home favorite; DAL lost both tackles; MIA faces an elite pass rush.','Who is safest?','BAL',['DAL','MIA','No selection'],'BAL has the strongest favorite profile without the listed lineup warning.'],
 ['rest-edge','SF is rested after a bye; GB plays a third road game; NYJ starts a rookie quarterback.','Make the safest pick.','SF',['GB','NYJ','Save every team'],'Rest and stability make SF the least fragile choice.'],
 ['weather-favorite','DET is a dome home favorite; SEA plays in severe wind; CIN has a limited quarterback.','Which side minimizes risk?','DET',['SEA','CIN','Skip automatically'],'DET avoids both the weather and injury uncertainty.'],
 ['trenches-edge','CLE has a major defensive-line advantage; LAR is missing two linemen; ATL is a small road favorite.','Which team is safest?','CLE',['LAR','ATL','No team'],'The clearest mismatch is CLE’s front against the opposing protection.'],
 ['run-floor','TEN is a home favorite with a strong run matchup; CHI faces an elite secondary; LV travels cross-country.','Pick one.','TEN',['CHI','LV','Hold all teams'],'A favorable rushing matchup gives TEN the most stable game plan.'],
 ['qb-health','HOU has a healthy starter; JAX’s quarterback is questionable; ARI changes starters.','Who carries the least uncertainty?','HOU',['JAX','ARI','Wait until next season'],'Known quarterback health makes HOU the safer survivor profile.'],
 ['defense-floor','PIT faces a turnover-prone offense; LAC faces the top scoring team; NO is a road underdog.','Choose the safest defense-led side.','PIT',['LAC','NO','Use a tie'],'PIT’s matchup offers the clearest path to short fields and a controlled game.'],
 ['travel-spot','MIN is home after extra rest; TB crosses two time zones; CAR returns from overtime.','Which spot is safest?','MIN',['TB','CAR','Avoid favorites'],'MIN owns the strongest rest and travel combination.'],
 ['division-avoid','KC hosts a non-division underdog; DAL visits a familiar rival; GB plays its rival for the second time.','Which pick avoids divisional volatility?','KC',['DAL','GB','Pick the largest stadium'],'KC has the cleaner non-division matchup.'],
 ['turnover-avoid','BUF protects the ball; IND has multiple giveaways in three straight games; WAS starts a backup center.','Who is safest?','BUF',['IND','WAS','Choose randomly'],'Ball security removes a major upset path.'],
 ['red-zone-edge','MIA has an elite red-zone offense at home; DEN struggles to finish drives; NYG settles for field goals.','Pick the side with the best scoring floor.','MIA',['DEN','NYG','Pass'],'Touchdown conversion gives MIA the best chance to separate.'],
 ['coach-rest','NE has two weeks to prepare; LV changed coordinators; CAR has six days after international travel.','Which team has the preparation edge?','NE',['LV','CAR','None'],'Extra preparation time creates the most stable setup.'],
 ['secondary-injury','DAL faces a secondary missing two starters; PHI faces a healthy elite defense; SEA plays in rain.','Who has the clearest matchup?','DAL',['PHI','SEA','Bench all three'],'The depleted secondary gives DAL the most direct offensive edge.'],
 ['rush-defense','BAL faces the league’s weakest run defense; ARI must throw against pressure; NYJ lacks its lead back.','Who is safest?','BAL',['ARI','NYJ','Save BAL forever'],'A dominant rushing favorite has multiple ways to control the game.'],
 ['home-dog-trap','SF is a solid home favorite; CIN is a road favorite against a dangerous home dog; TB is nearly a pick’em.','Avoid the trap and choose.','SF',['CIN','TB','Pick the underdog'],'SF has the clearest favorite and venue combination.'],
 ['line-stability','GB returns its full offensive line; LAR starts two backups; CHI shuffled three positions.','Who offers the safest protection floor?','GB',['LAR','CHI','Protection does not matter'],'Continuity reduces negative-play and turnover risk.'],
 ['special-teams','KC owns strong kicking and return units; LAC has a new kicker; JAX allows long returns.','Who has the safest hidden-yard edge?','KC',['LAC','JAX','Ignore special teams'],'KC has fewer special-teams upset paths.'],
 ['motivation-noise','DET has a clear matchup edge; NO “must win” but is injured; LV has a revenge narrative.','Pick based on football, not narrative.','DET',['NO','LV','The revenge team'],'DET’s matchup is stronger than motivation-only stories.'],
 ['pace-control','PHI can control the game on the ground; MIA enters a likely shootout; ATL relies on late comebacks.','Which profile is safest?','PHI',['MIA','ATL','Highest total only'],'A strong rushing favorite can win without extreme scoring variance.'],
 ['rookie-road','BUF hosts a rookie quarterback; DEN starts a rookie on the road; NYG faces a veteran defense.','Who is safest?','BUF',['DEN','NYG','Pick the rookie'],'BUF benefits from home field and the opponent’s processing risk.'],
 ['altitude-home','DEN is home at altitude against a tired defense; SEA travels after overtime; TB plays in extreme heat.','Which environmental edge is cleanest?','DEN',['SEA','TB','No environment matters'],'DEN is adapted to the listed condition and faces a fatigued opponent.'],
 ['market-move','HOU remains favored after injury news; IND’s line moves sharply against it; CLE loses its quarterback late.','Which side has the fewest new red flags?','HOU',['IND','CLE','Chase the biggest move'],'HOU’s stable price and lineup are safer than negative late information.'],
 ['schedule-fatigue','SF comes off a normal home week; JAX plays a third straight road game; MIN returns from overseas.','Who is safest?','SF',['JAX','MIN','Travel farther'],'SF avoids the accumulated travel load.'],
 ['balanced-team','BAL ranks well on offense, defense and special teams; DAL depends on turnovers; LAC depends on explosive plays.','Which team has the most paths to win?','BAL',['DAL','LAC','Use last week’s score'],'Balance lowers reliance on one volatile advantage.'],
].map(([family,context,prompt,correct,wrong,explanation])=>({family,context,prompt,correct,wrong,explanation} as Concept));

const concepts:Record<GauntletMode,Concept[]>={'FILM ROOM':film,'PREDICTIONS':predictions,'DEBATES':debates,'SURVIVOR':survivor};
const tierLead:Record<GauntletTier,string>={ROOKIE:'Identify the clearest football clue.',PRO:'Account for assignment and situation.', 'ALL-PRO':'Separate the primary signal from the disguise.', 'HALL OF FAME':'Resolve the full chain of responsibility and game context.'};
const tierDetail:Record<GauntletTier,string>={ROOKIE:'The picture is simplified.',PRO:'One secondary clue may be noise.','ALL-PRO':'Personnel and leverage can change the answer.','HALL OF FAME':'Assume the opponent is disguising intent until the snap confirms it.'};

const multiReadPrompt:Record<GauntletMode,Record<Exclude<GauntletTier,'ROOKIE'>,string>>={
 'FILM ROOM':{
  PRO:'The picture changes after the snap. Which coaching read should control the diagnosis?',
  'ALL-PRO':'The offense and defense are countering each other. Which two-part diagnosis reconciles both assignments?',
  'HALL OF FAME':'Resolve the complete pre-snap, post-snap, and late-down responsibility chain.',
 },
 'PREDICTIONS':{
  PRO:'A second game-state signal arrives. Which projection update should carry the most weight?',
  'ALL-PRO':'Two predictive signals pull in different directions. Which combined forecast handles both?',
  'HALL OF FAME':'Build the full forecast across matchup, game script, and late-breaking context.',
 },
 'DEBATES':{
  PRO:'The argument adds a second claim. Which evidence response now wins the exchange?',
  'ALL-PRO':'Both sides cite valid but incomplete evidence. Which answer reconciles the full record?',
  'HALL OF FAME':'Resolve all three claims without dropping team, era, role, or sample-size context.',
 },
 'SURVIVOR':{
  PRO:'A second risk report changes the board. Which update is the disciplined survivor move?',
  'ALL-PRO':'The safest favorite and the cleanest matchup are no longer the same team. Which process handles both?',
  'HALL OF FAME':'Set the card after reconciling baseline safety, late news, and pool-leverage risk.',
 },
};

function combinedConcept(mode:GauntletMode,tier:Exclude<GauntletTier,'ROOKIE'>,index:number):Concept{
  const pool=concepts[mode];
  const first=pool[index];
  const second=pool[(index+(tier==='PRO'?5:tier==='ALL-PRO'?9:13))%pool.length];
  if(tier==='PRO')return{
    family:`${first.family}__update__${second.family}`,
    context:`INITIAL READ · ${first.context} UPDATED READ · ${second.context}`,
    prompt:multiReadPrompt[mode][tier],
    correct:`Update to the second read: ${second.correct}`,
    wrong:[`Freeze the first read: ${first.correct}`,`Discard both for: ${second.wrong[0]}`,`Ignore the update and choose: ${first.wrong[1]}`],
    explanation:`The later information changes the decision. ${second.explanation} The initial clue still matters as context: ${first.explanation}`,
  };
  if(tier==='ALL-PRO')return{
    family:`${first.family}__reconcile__${second.family}`,
    context:`PRIMARY SIGNAL · ${first.context} COUNTER-SIGNAL · ${second.context}`,
    prompt:multiReadPrompt[mode][tier],
    correct:`Reconcile both: ${first.correct}; then ${second.correct}`,
    wrong:[`Use only the first signal: ${first.correct}`,`Use only the counter-signal: ${second.correct}`,`Reject both for: ${first.wrong[0]}`],
    explanation:`The correct answer preserves both independent football clues instead of pretending one erases the other. ${first.explanation} ${second.explanation}`,
  };
  const third=pool[(index+19)%pool.length];
  return{
    family:`${first.family}__chain__${second.family}__${third.family}`,
    context:`BASELINE · ${first.context} ADJUSTMENT · ${second.context} FINAL CONSTRAINT · ${third.context}`,
    prompt:multiReadPrompt[mode][tier],
    correct:`Complete chain: ${first.correct} → ${second.correct} → ${third.correct}`,
    wrong:[`Stop after the baseline: ${first.correct}`,`Skip the adjustment: ${first.correct} → ${third.correct}`,`Abandon the chain for: ${second.wrong[1]}`],
    explanation:`Hall of Fame decisions require the entire sequence. ${first.explanation} ${second.explanation} ${third.explanation}`,
  };
}

function conceptsForTier(mode:GauntletMode,tier:GauntletTier){
  return tier==='ROOKIE'?concepts[mode]:concepts[mode].map((_,index)=>combinedConcept(mode,tier,index));
}

function hash(value:string){let h=2166136261;for(const char of value){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function seededRandom(seed:string){let state=hash(seed)||1;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffled<T>(items:T[],seed:string){const out=[...items];const random=seededRandom(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function scenario(mode:GauntletMode,tier:GauntletTier,concept:Concept,index:number):GauntletScenario{
  const seed=`${mode}:${tier}:${concept.family}:${index}`;
  const options=shuffled([concept.correct,...concept.wrong],seed);
  const situational=['1st & 10','2nd & medium','3rd & short','3rd & long','late-game','red zone'][hash(seed)%6];
  return {id:`${mode.toLowerCase().replaceAll(' ','-')}:${tier.toLowerCase()}:${index+1}`,mode,tier,family:concept.family,
    context:`${situational.toUpperCase()} · ${concept.context} ${tierDetail[tier]}`,
    prompt:tier==='ROOKIE'?`${tierLead[tier]} ${concept.prompt}`:concept.prompt,options,correct:options.indexOf(concept.correct),explanation:concept.explanation};
}

export function buildScenarioCatalog():GauntletScenario[]{
  return GAUNTLET_MODES.flatMap(mode=>GAUNTLET_TIERS.flatMap(tier=>conceptsForTier(mode,tier).map((concept,index)=>scenario(mode,tier,concept,index))));
}
export const GAUNTLET_CATALOG=buildScenarioCatalog();
export function scenariosFor(mode:GauntletMode,tier:GauntletTier){return GAUNTLET_CATALOG.filter(item=>item.mode===mode&&item.tier===tier);}
const runtimeFrames:Record<GauntletMode,string[]>={
 'FILM ROOM':['ALL-22 CHECK','END-ZONE ANGLE','COACHING TAPE','POST-SNAP FREEZE','SIDELINE TABLET'],
 'PREDICTIONS':['GAME-SCRIPT MODEL','MARKET CHECK','INJURY-ADJUSTED READ','PACE CHECK','WIN-PROBABILITY ROOM'],
 'DEBATES':['FILM-ROOM PANEL','RADIO DEBATE','FRONT-OFFICE TABLE','ANALYTICS DESK','LOCKER-ROOM ARGUMENT'],
 'SURVIVOR':['WEEKLY CARD','UPSET-RISK BOARD','FINAL LOCK WINDOW','SURVIVOR WAR ROOM','POOL DECISION'],
};
const runtimePrompts=['Lock one answer.','Separate signal from noise.','Make the highest-percentage call.','Choose the most defensible answer.','Trust the football evidence.'];
function varyScenario(item:GauntletScenario,seed:string){
 const variantSeed=`${seed}:${item.id}`;const correctAnswer=item.options[item.correct];const options=shuffled(item.options,`${variantSeed}:answers`);
 return{...item,id:`${item.id}:v${hash(variantSeed)%997}`,context:`${runtimeFrames[item.mode][hash(`${variantSeed}:frame`)%runtimeFrames[item.mode].length]} · ${item.context}`,prompt:`${runtimePrompts[hash(`${variantSeed}:prompt`)%runtimePrompts.length]} ${item.prompt}`,options,correct:options.indexOf(correctAnswer)};
}
export function buildGauntletRound(mode:GauntletMode,tier:GauntletTier,count=10,seed=`${Date.now()}`){
  const candidates=shuffled(scenariosFor(mode,tier),seed);const families=new Set<string>();const result:GauntletScenario[]=[];
  for(const item of candidates){if(families.has(item.family))continue;families.add(item.family);result.push(varyScenario(item,seed));if(result.length===count)break;}
  return result;
}
export function utcDateKey(date=new Date()){return date.toISOString().slice(0,10);}
export function buildDailyGauntlet(dateKey=utcDateKey()){
  const rotation:GauntletMode[]=shuffled(GAUNTLET_MODES,`${dateKey}:mode-order`);
  const modes=[...rotation,rotation[hash(dateKey)%rotation.length]];
  return modes.map((mode,index)=>{
    const tier=GAUNTLET_TIERS[(hash(`${dateKey}:tier:${index}`)+index)%GAUNTLET_TIERS.length];
    const pool=scenariosFor(mode,tier);const item=pool[hash(`${dateKey}:${mode}:${index}`)%pool.length];return varyScenario(item,`${dateKey}:daily:${index}`);
  });
}

export function shouldEliminateGauntletRun(mode:GauntletMode,correct:boolean,dailyDate?:string){
  return mode==='SURVIVOR'&&!correct&&!dailyDate;
}

export type GauntletProgress={xp:number;level:number;currentStreak:number;longestStreak:number;totalCorrect:number;totalAnswered:number;highScores:Record<string,number>;daily:Record<string,{score:number;completed:boolean}>};
const EMPTY_PROGRESS:GauntletProgress={xp:0,level:1,currentStreak:0,longestStreak:0,totalCorrect:0,totalAnswered:0,highScores:{},daily:{}};
const progressKey=(userId?:string)=>`ballknower_gauntlet_progress_v1:${userId||'guest'}`;
export function loadGauntletProgress(userId?:string):GauntletProgress{try{const value=JSON.parse(localStorage.getItem(progressKey(userId))||'null');return value?{...EMPTY_PROGRESS,...value,highScores:value.highScores||{},daily:value.daily||{}}:{...EMPTY_PROGRESS};}catch{return{...EMPTY_PROGRESS};}}
export function saveGauntletProgress(progress:GauntletProgress,userId?:string){try{localStorage.setItem(progressKey(userId),JSON.stringify(progress));}catch{}}
export function mergeGauntletProgress(local:GauntletProgress,cloud:GauntletProgress):GauntletProgress{
  const highScores={...local.highScores};
  for(const[key,value]of Object.entries(cloud.highScores||{}))highScores[key]=Math.max(highScores[key]||0,value||0);
  const daily={...local.daily};
  for(const[date,value]of Object.entries(cloud.daily||{})){
    const existing=daily[date];
    daily[date]={score:Math.max(existing?.score||0,value?.score||0),completed:Boolean(existing?.completed||value?.completed)};
  }
  const xp=Math.max(local.xp||0,cloud.xp||0);
  return{
    xp,
    level:Math.max(local.level||1,cloud.level||1,Math.floor(xp/250)+1),
    currentStreak:Math.max(local.currentStreak||0,cloud.currentStreak||0),
    longestStreak:Math.max(local.longestStreak||0,cloud.longestStreak||0),
    totalCorrect:Math.max(local.totalCorrect||0,cloud.totalCorrect||0),
    totalAnswered:Math.max(local.totalAnswered||0,cloud.totalAnswered||0),
    highScores,daily,
  };
}
export function recordGauntletAnswer(progress:GauntletProgress,correct:boolean,xp:number){const streak=correct?progress.currentStreak+1:0;const nextXp=progress.xp+(correct?xp:0);return{...progress,xp:nextXp,level:Math.floor(nextXp/250)+1,currentStreak:streak,longestStreak:Math.max(progress.longestStreak,streak),totalCorrect:progress.totalCorrect+(correct?1:0),totalAnswered:progress.totalAnswered+1};}
export function recordGauntletRun(progress:GauntletProgress,key:string,score:number,total:number,dateKey?:string){const highScores={...progress.highScores,[key]:Math.max(progress.highScores[key]||0,score)};const daily=dateKey?{...progress.daily,[dateKey]:{score,completed:true}}:progress.daily;return{...progress,highScores,daily,xp:progress.xp+(score===total?50:0),level:Math.floor((progress.xp+(score===total?50:0))/250)+1};}
