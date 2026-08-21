export type OwnerMetric='cashM'|'approval'|'staffMorale'|'leagueInfluence'|'legacy'|'stadium'|'fanTrust';
export type OwnerEffect=Partial<Record<OwnerMetric,number>>;
export type OwnerChoice={label:string;detail:string;effect:OwnerEffect};
export type OwnerStoryPhase='pre'|'early'|'mid'|'late';
export type OwnerDecision={id:string;category:string;eyebrow:string;title:string;scene:string;pressure:string;visual?:string;phases?:OwnerStoryPhase[];choices:OwnerChoice[]};

const c=(label:string,detail:string,effect:OwnerEffect):OwnerChoice=>({label,detail,effect});
const s=(id:string,category:string,title:string,scene:string,pressure:string,choices:OwnerChoice[],phases?:OwnerStoryPhase[],visual?:string):OwnerDecision=>({id,category,eyebrow:category,title,scene,pressure,choices,phases,visual});

export const OWNER_DECISIONS:OwnerDecision[]=[
  s('star-trade-demand','LIVE · PLAYER PRESS CONFERENCE','YOUR STAR WANTS OUT','Your best player steps to the podium and demands a new deal or a trade. The clip is everywhere.','The locker room and the entire fanbase are watching.',[
    c('PAY THE STAR','Keep the locker room together; take the cash hit.',{cashM:-38,approval:5,staffMorale:6,fanTrust:7,legacy:2}),c('LET THE GM HANDLE IT','Trust football operations.',{staffMorale:8,leagueInfluence:2,approval:-2,legacy:1}),c('ORDER A TRADE','Take control and risk the fanbase.',{cashM:16,approval:-10,fanTrust:-12,staffMorale:-5,legacy:-2})
  ],undefined,'trade'),
  s('stadium-partnership','CITY HALL · CLOSED DOOR','THE STADIUM BILLION','The mayor offers a stadium partnership for a twenty-year commitment.','Cash, the building and your city relationship are at stake.',[
    c('BUILD TOGETHER','Share the cost and commit.',{cashM:-120,stadium:18,approval:8,fanTrust:10,legacy:6}),c('PRIVATELY FINANCE','Keep control and take the risk.',{cashM:-210,stadium:24,approval:5,legacy:9}),c('WALK AWAY','Protect cash; anger local fans.',{cashM:15,approval:-7,fanTrust:-15,legacy:-3})
  ],['pre','early']),
  s('rule-change-vote','LEAGUE MEETING · FINAL VOTE','THE VOTE IS 23–8','One vote decides a controversial rule change. Powerful owners expect your support.','Either side creates allies and enemies.',[
    c('BACK THE OLD GUARD','Gain influence with established owners.',{leagueInfluence:12,approval:-5,fanTrust:-4}),c('SIDE WITH PLAYERS','Protect player trust.',{leagueInfluence:-6,approval:8,fanTrust:9,staffMorale:4}),c('ABSTAIN','Avoid the fight; lose respect.',{leagueInfluence:-4,approval:-2})
  ]),
  s('coach-lost-room','MONDAY · TEAM FACILITY','THE COACH LOST THE ROOM','Three veterans go public after another ugly loss. Your coach wants you out of his locker room.','Patience may look steady—or weak.',[
    c('BACK THE COACH','Demand a turnaround.',{staffMorale:9,approval:-4}),c('FIRE HIM NOW','Reset the building.',{cashM:-18,approval:7,staffMorale:-12}),c('LET THE GM DECIDE','Honor the chain of command.',{staffMorale:6,leagueInfluence:2})
  ],['mid','late']),
  s('ticket-price-surge','FAN COUNCIL · TOWN HALL','WINNING GOT EXPENSIVE','Ticket demand explodes. Your business team wants an eighteen-percent increase.','Revenue builds facilities. Affordable seats build generations.',[
    c('RAISE PRICES','Maximize demand.',{cashM:44,approval:-9,fanTrust:-11}),c('SMALL INCREASE','Balance revenue and loyalty.',{cashM:19,approval:1,fanTrust:1}),c('FREEZE PRICES','Make loyalty your identity.',{cashM:-8,approval:10,fanTrust:13,legacy:6})
  ],['mid','late']),
  s('draft-quarterback','DRAFT NIGHT · WAR ROOM','THE QUARTERBACK IS FALLING','A top quarterback slides within reach. Your scouts love him, but your veteran starter just signed an extension.','One trade could reshape the next decade—or split the building.',[
    c('TRADE UP','Spend picks and secure the future.',{cashM:-8,approval:8,staffMorale:-3,legacy:6}),c('STAY PUT','Trust the board and protect your picks.',{staffMorale:5,approval:-2}),c('CALL YOUR STARTER','Let the veteran help make the call.',{fanTrust:4,staffMorale:7,leagueInfluence:-2})
  ],['pre']),
  s('gm-board-leak','TEAM FACILITY · SECURITY ALERT','YOUR DRAFT BOARD LEAKED','A photo of the entire draft board reaches a national reporter six hours before round one.','Changing the board creates chaos. Keeping it lets rivals predict every move.',[
    c('REBUILD THE BOARD','Change priorities immediately.',{staffMorale:-6,leagueInfluence:4,legacy:2}),c('PLANT A FAKE LEAK','Turn the breach into leverage.',{leagueInfluence:9,approval:-3,legacy:4}),c('HOLD THE COURSE','Trust your evaluations.',{staffMorale:7,leagueInfluence:-4})
  ],['pre']),
  s('medical-protocol','MEDICAL WING · 6:10 AM','THE DOCTOR SAYS SIT HIM','Your franchise player clears practice, but the independent specialist says another hit could end his season.','The biggest game of the year is forty-eight hours away.',[
    c('SHUT HIM DOWN','Protect the player no matter the standings.',{approval:4,staffMorale:9,fanTrust:6,legacy:6}),c('SEEK ANOTHER OPINION','Buy time without making the final call.',{cashM:-2,approval:-3,staffMorale:-2}),c('LET HIM PLAY','Accept the competitive and human risk.',{approval:5,staffMorale:-10,fanTrust:-7,legacy:-5})
  ],['late']),
  s('international-home-game','LEAGUE OFFICE · LONDON CALL','THE LEAGUE WANTS YOUR HOME GAME','The commissioner offers global marketing money if you move a marquee home game overseas.','International growth means one fewer Sunday for local season-ticket holders.',[
    c('TAKE THE DEAL','Grow the brand worldwide.',{cashM:26,leagueInfluence:8,fanTrust:-8,legacy:3}),c('DEMAND AN AWAY GAME','Negotiate without sacrificing home fans.',{leagueInfluence:3,fanTrust:5,cashM:8}),c('DECLINE','Keep every home date in your city.',{fanTrust:10,leagueInfluence:-5,approval:4})
  ],['pre','early']),
  s('stadium-naming-rights','BOARDROOM · SPONSOR SUMMIT','THE NAME ON THE STADIUM','A technology company offers record money for naming rights, but its CEO is under investigation.','The check clears today. The reputation damage may last for years.',[
    c('SIGN THE DEAL','Take the record sponsorship.',{cashM:72,approval:-8,fanTrust:-10,legacy:-4}),c('DEMAND AN ETHICS CLAUSE','Keep negotiating with an exit door.',{cashM:39,approval:3,leagueInfluence:2}),c('WALK AWAY','Protect the franchise name.',{fanTrust:9,approval:7,legacy:5})
  ]),
  s('legend-public-feud','ALUMNI DINNER · OPEN MIC','A LEGEND CALLS YOU CHEAP','A retired icon says your franchise no longer takes care of the people who built it.','Every former player in the room is waiting for your response.',[
    c('CREATE AN ALUMNI FUND','Commit long-term support.',{cashM:-14,fanTrust:10,legacy:9,staffMorale:4}),c('MEET IN PRIVATE','Lower the temperature without admitting fault.',{approval:3,legacy:2}),c('FIGHT BACK PUBLICLY','Defend the business record.',{approval:-6,fanTrust:-9,leagueInfluence:3})
  ]),
  s('practice-facility-land','COUNTY HEARING · ZONING BOARD','THE FACILITY NEEDS A HOME','Your football staff wants a state-of-the-art complex on land promised for public recreation.','The team gets better resources only if the neighborhood gives something up.',[
    c('BUILD WITH A PUBLIC PARK','Redesign the project for shared use.',{cashM:-54,staffMorale:8,approval:10,fanTrust:12,legacy:8}),c('BUILD AS PLANNED','Prioritize football operations.',{cashM:-35,staffMorale:12,approval:-9,fanTrust:-8}),c('RENOVATE THE OLD SITE','Avoid the land fight.',{cashM:-22,staffMorale:4,stadium:5,approval:5})
  ],['pre']),
  s('analytics-department','FOOTBALL OPS · BUDGET REVIEW','THE ALGORITHM WANTS A SEAT','Your new analytics group has identified undervalued players, but veteran scouts refuse to share their draft room.','Modernizing too quickly could cost institutional knowledge.',[
    c('GIVE DATA FINAL SAY','Build around the model.',{cashM:-6,staffMorale:-6,legacy:5}),c('PAIR EVERY ANALYST WITH A SCOUT','Force collaboration.',{cashM:-8,staffMorale:9,legacy:4}),c('KEEP THE OLD SYSTEM','Protect the scouting culture.',{staffMorale:5,approval:-3,legacy:-2})
  ],['pre']),
  s('coordinator-poached','RIVAL TEAM · PERMISSION REQUEST','THEY WANT YOUR PLAY-CALLER','A rival requests an interview with your star coordinator during the playoff push.','Blocking the interview helps today and damages your reputation tomorrow.',[
    c('GRANT PERMISSION','Honor his opportunity.',{staffMorale:8,leagueInfluence:5,approval:-2}),c('BLOCK UNTIL SEASON ENDS','Protect the playoff run.',{approval:5,staffMorale:-8,leagueInfluence:-4}),c('PROMISE THE NEXT HEAD JOB','Keep him with a succession plan.',{cashM:-5,staffMorale:6,legacy:3})
  ],['late']),
  s('concession-boycott','STADIUM PLAZA · FAN PROTEST','THE $19 HOT DOG','Supporters organize a concession boycott after another price increase. Your vendor contract guarantees profit but allows no outside food.','A small menu decision has become a symbol of who the franchise serves.',[
    c('CUT PRICES NOW','Absorb the vendor penalty.',{cashM:-12,fanTrust:15,approval:10}),c('ADD A VALUE MENU','Compromise without rewriting the deal.',{cashM:-3,fanTrust:7,approval:4}),c('WAIT IT OUT','Protect the contract.',{cashM:11,fanTrust:-13,approval:-8})
  ]),
  s('union-grievance','PLAYER ASSOCIATION · FORMAL NOTICE','THE PRACTICE CLOCK LIED','Players allege the coaching staff hid extra practice time from league monitors.','Defending the staff may cost trust; admitting it may cost draft capital.',[
    c('SELF-REPORT','Cooperate fully with the league.',{leagueInfluence:2,staffMorale:-7,fanTrust:6,legacy:4}),c('DEFEND THE STAFF','Challenge the grievance.',{staffMorale:8,leagueInfluence:-8,approval:-4}),c('FIRE THE OPERATIONS DIRECTOR','Contain the damage.',{cashM:-3,staffMorale:-4,leagueInfluence:3})
  ]),
  s('scout-misconduct','HOTEL LOBBY · COMBINE WEEK','YOUR TOP SCOUT CROSSED THE LINE','A prospect’s family reports that your lead scout asked an invasive question during an interview.','The draft is six weeks away and every prospect agent is calling.',[
    c('SUSPEND THE SCOUT','Set the standard immediately.',{staffMorale:3,approval:8,fanTrust:7,legacy:5}),c('ORDER AN INVESTIGATION','Gather facts before deciding.',{cashM:-2,approval:2,staffMorale:-2}),c('CALL IT A MISUNDERSTANDING','Keep the draft team intact.',{staffMorale:4,approval:-10,fanTrust:-9,legacy:-4})
  ],['pre']),
  s('cap-restructure','CAP OFFICE · DEADLINE DAY','THE WINDOW HAS A PRICE','Your GM can restructure three veteran contracts to create room for one final championship push.','The bill lands in future seasons whether the trophy arrives or not.',[
    c('PUSH THE MONEY FORWARD','Go all-in now.',{cashM:-18,approval:10,legacy:5}),c('RESTRUCTURE ONE DEAL','Add help without emptying tomorrow.',{cashM:-7,approval:4,staffMorale:3}),c('PROTECT THE FUTURE','Refuse to borrow from later seasons.',{approval:-5,leagueInfluence:3,legacy:1})
  ],['early','mid']),
  s('tampering-accusation','LEAGUE LEGAL · URGENT CALL','A RIVAL ACCUSES YOU OF TAMPERING','Another owner claims your executive contacted his star before free agency opened. The evidence is incomplete.','A private settlement looks guilty. A public fight could expose everyone.',[
    c('SETTLE QUIETLY','End the dispute before discovery.',{cashM:-9,leagueInfluence:-4,approval:-2}),c('REQUEST A FULL HEARING','Put every record on the table.',{leagueInfluence:5,approval:4,staffMorale:-2}),c('COUNTER-ACCUSE','Turn the spotlight on the rival.',{leagueInfluence:-7,fanTrust:3,legacy:-3})
  ],['pre']),
  s('throwback-uniform','EQUIPMENT ROOM · DESIGN REVEAL','THE THROWBACK IS WRONG','The new throwback uniform sells out instantly—then alumni point out that the design rewrites a painful chapter of team history.','Merchandise revenue is soaring while the people who wore it feel erased.',[
    c('REDESIGN IT','Honor the history and refund orders.',{cashM:-9,fanTrust:10,legacy:7}),c('ADD THE MISSING STORY','Keep the design and fund an exhibit.',{cashM:-3,fanTrust:6,legacy:5}),c('KEEP SELLING','Treat it as entertainment.',{cashM:18,fanTrust:-9,legacy:-5})
  ]),
  s('field-surface','PLAYER SAFETY COUNCIL · 7:00 AM','THE TURF TEST FAILED','Independent testing shows your field is harder than league recommendations. Replacing it means two road games and a major bill.','Players want action before the next kickoff.',[
    c('REPLACE IT IMMEDIATELY','Move games and protect players.',{cashM:-24,staffMorale:13,approval:7,stadium:8,legacy:6}),c('REPAIR THE WORST AREAS','Reduce risk without relocating.',{cashM:-8,staffMorale:4,stadium:3}),c('CHALLENGE THE TEST','Keep the schedule unchanged.',{cashM:3,staffMorale:-12,approval:-8,legacy:-5})
  ],['early','mid']),
  s('weather-roof','OPERATIONS CENTER · STORM TRACKER','THE STORM WILL HIT AT KICKOFF','A historic storm is forecast for Sunday. The league will let you move the game only if you decide tonight.','Competitive advantage, fan travel and public safety collide.',[
    c('MOVE THE GAME EARLY','Choose safety over home-field rhythm.',{fanTrust:9,approval:6,leagueInfluence:3}),c('RELOCATE TO A NEUTRAL SITE','Preserve the time slot.',{cashM:-7,fanTrust:2,leagueInfluence:4}),c('KEEP THE SCHEDULE','Trust the forecast will change.',{cashM:8,fanTrust:-11,approval:-8})
  ]),
  s('community-land','NEIGHBORHOOD MEETING · PACKED GYM','THE PARKING LOT TOOK A BLOCK','Residents say the stadium expansion plan will demolish homes and split a neighborhood.','The project cannot proceed unchanged without forcing families out.',[
    c('REDRAW THE PLAN','Save every home and accept delays.',{cashM:-28,stadium:5,fanTrust:14,approval:11,legacy:8}),c('OFFER ABOVE-MARKET BUYOUTS','Compensate residents and continue.',{cashM:-42,stadium:10,fanTrust:2}),c('USE EMINENT DOMAIN','Keep the original timeline.',{cashM:-12,stadium:14,fanTrust:-18,approval:-13,legacy:-8})
  ]),
  s('charity-audit','FOUNDATION OFFICE · AUDIT DAY','THE CHARITY NUMBERS DO NOT MATCH','An audit finds that a longtime foundation director steered grants toward friends. No owner money is missing.','Your name is on every donation campaign.',[
    c('PUBLISH THE AUDIT','Remove the director and disclose everything.',{cashM:-4,approval:10,fanTrust:12,legacy:7}),c('FIX IT PRIVATELY','Repay questionable grants without a spectacle.',{cashM:-8,approval:-2,fanTrust:-3}),c('BLAME THE ACCOUNTANTS','Protect the director and attack the audit.',{cashM:2,approval:-11,fanTrust:-12,legacy:-6})
  ]),
  s('local-broadcast','MEDIA ROOM · RIGHTS DISPUTE','LOCAL FANS ARE BLACKED OUT','A carriage dispute removes Sunday’s game from thousands of local homes. The broadcaster says your franchise must accept less money to restore it.','The people closest to the team may miss its biggest game.',[
    c('TAKE LESS MONEY','Restore the broadcast immediately.',{cashM:-16,fanTrust:15,approval:10}),c('STREAM IT FREE LOCALLY','Build a one-game alternative.',{cashM:-7,fanTrust:11,leagueInfluence:-2}),c('HOLD THE LINE','Let the broadcaster take the blame.',{cashM:19,fanTrust:-12,approval:-9})
  ],['mid','late']),
  s('player-social-post','COMMUNICATIONS OFFICE · 2:13 AM','THE POST IS STILL LIVE','A team captain posts an attack on coaches after a loss. Millions have already seen it.','Discipline may restore order or turn a private conflict into a public war.',[
    c('MEET BEFORE PUNISHING','Hear him out at sunrise.',{staffMorale:8,approval:2,fanTrust:3}),c('SUSPEND HIM ONE GAME','Make the standard clear.',{staffMorale:-4,approval:7,fanTrust:2}),c('ORDER HIM TO DELETE IT','Try to make the story disappear.',{staffMorale:-7,approval:-5,fanTrust:-4})
  ],['early','mid','late']),
  s('backup-quarterback','COACHING SUITE · MONDAY MORNING','THE BACKUP WON THE CITY','Your backup quarterback delivers three straight wins while the expensive starter recovers. The starter is cleared today.','The next lineup card will divide the locker room and the fanbase.',[
    c('RIDE THE HOT HAND','Keep the backup in charge.',{approval:9,staffMorale:-4,fanTrust:7}),c('RESTORE THE STARTER','Honor the depth chart and contract.',{staffMorale:5,approval:-7}),c('LET THEM COMPETE','Make practice decide it.',{staffMorale:8,fanTrust:2,legacy:2})
  ],['mid','late']),
  s('playoff-injury','SIDELINE TENT · FOURTH QUARTER','HE SAYS HE CAN GO BACK IN','Your star is limping in a win-or-go-home game. Medical staff will not clear him, but he is pleading directly with you.','One emotional decision could define both careers.',[
    c('FOLLOW THE DOCTORS','End the discussion and protect him.',{staffMorale:8,fanTrust:8,legacy:7}),c('ASK FOR A RECHECK','Delay the choice for another series.',{approval:-2,staffMorale:-3}),c('OVERRIDE THE STAFF','Send him back if he accepts the risk.',{approval:6,staffMorale:-14,fanTrust:-8,legacy:-8})
  ],['late']),
  s('scouts-vs-model','DRAFT ROOM · FINAL RANKING','THE SCOUTS AND THE MODEL DISAGREE','Your scouts rank a small-school defender first. The analytics model says he has a third-round ceiling.','This pick will decide which department owns the room next year.',[
    c('TRUST THE SCOUTS','Bet on live evaluation.',{staffMorale:8,legacy:2}),c('TRUST THE MODEL','Follow the data.',{staffMorale:-5,legacy:4}),c('TRADE DOWN','Collect value and avoid the argument.',{cashM:4,leagueInfluence:5,staffMorale:-2})
  ],['pre']),
  s('draft-clock-trade','DRAFT NIGHT · 90 SECONDS','THE PHONE WILL NOT STOP','Three teams call while your top remaining player is still available. One offer includes next year’s first-round pick.','There is no time to build consensus.',[
    c('MAKE THE PICK','Take the player everyone prepared for.',{staffMorale:7,approval:4}),c('TAKE NEXT YEAR’S FIRST','Bet on patience and future value.',{leagueInfluence:7,approval:-3,legacy:3}),c('START A BIDDING WAR','Use every second to improve the offer.',{leagueInfluence:10,staffMorale:-4,approval:2})
  ],['pre']),
  s('suite-sponsor','OWNER SUITE · RIVALRY NIGHT','YOUR BIGGEST SPONSOR BOOED THE TEAM','A sponsor insults players within earshot of their families, then reminds you how much his company pays.','Removing him protects the room and risks a major partnership.',[
    c('REMOVE HIM TONIGHT','Put the team before the check.',{cashM:-24,staffMorale:13,fanTrust:9,legacy:6}),c('DEMAND A PUBLIC APOLOGY','Give the sponsor one chance.',{cashM:-5,staffMorale:6,approval:5}),c('MOVE THE FAMILIES','Avoid confronting the sponsor.',{cashM:14,staffMorale:-11,fanTrust:-7})
  ]),
  s('minority-investment','OWNERSHIP GROUP · TERM SHEET','A BILLIONAIRE WANTS IN','An investor offers a premium for a minority stake but demands a voice in football operations.','The money can transform the franchise. The influence may never leave.',[
    c('ACCEPT WITH NO FOOTBALL CONTROL','Take less money and protect the structure.',{cashM:90,leagueInfluence:4,legacy:3}),c('ACCEPT THE FULL OFFER','Add major capital and share control.',{cashM:150,staffMorale:-7,approval:-3}),c('REMAIN INDEPENDENT','Keep every decision yours.',{approval:5,legacy:5})
  ],['pre']),
  s('cybersecurity-breach','TECH CENTER · SYSTEM LOCKDOWN','THE PLAYBOOK IS FOR SALE','Hackers claim they stole scouting reports, player medical records and contract plans.','Paying may protect secrets but funds the people attacking the franchise.',[
    c('LOCK DOWN AND DISCLOSE','Notify everyone and rebuild systems.',{cashM:-18,staffMorale:6,approval:8,legacy:5}),c('PAY THROUGH INSURANCE','Try to contain the leak quietly.',{cashM:-7,approval:-4,leagueInfluence:-2}),c('CALL THEIR BLUFF','Refuse payment and prepare for release.',{cashM:-3,staffMorale:-8,approval:2})
  ]),
  s('betting-sponsor','PARTNERSHIP OFFICE · FINAL OFFER','THE SPORTSBOOK WANTS THE JERSEY','A betting company offers the largest sponsorship in team history for prominent branding.','The revenue is real. So are concerns from families and recovering players.',[
    c('ACCEPT WITH SAFEGUARDS','Fund addiction support and restrict youth ads.',{cashM:48,approval:1,fanTrust:-2,legacy:2}),c('ACCEPT EVERYTHING','Take the full package.',{cashM:76,approval:-8,fanTrust:-10,legacy:-4}),c('DECLINE THE CATEGORY','Keep betting off the uniform.',{fanTrust:8,approval:6,legacy:4})
  ]),
  s('international-pathway','SCOUTING SUMMIT · GLOBAL DESK','THE PROSPECT HAS NEVER PLAYED','A world-class international athlete tests off the charts but has never played organized football.','Developing him costs a roster spot and could open an entire market.',[
    c('SIGN AND DEVELOP HIM','Invest in the long-term upside.',{cashM:-4,leagueInfluence:5,legacy:5}),c('OFFER A PRACTICE ROLE','Create a lower-risk pathway.',{cashM:-2,staffMorale:3,leagueInfluence:2}),c('PASS FOR EXPERIENCE','Keep the roster predictable.',{staffMorale:2,legacy:-1})
  ],['pre']),
  s('flag-football','COMMUNITY PROGRAM · LAUNCH DAY','THE GIRLS NEED A LEAGUE','Local schools ask the franchise to fund a girls’ flag football league across the region.','The program will not help Sunday’s record, but it may shape the next generation.',[
    c('FUND THE FULL LEAGUE','Build fields, coaches and scholarships.',{cashM:-12,fanTrust:14,approval:11,legacy:10}),c('START A PILOT','Prove the idea in four schools.',{cashM:-4,fanTrust:7,approval:5,legacy:4}),c('LICENSE THE LOGO ONLY','Support the launch without funding it.',{fanTrust:-3,approval:-2})
  ]),
  s('alumni-health-fund','ALUMNI COUNCIL · PRIVATE TESTIMONY','THE OLD PLAYERS NEED HELP','Former players describe medical costs that existing league programs will not cover.','They built the brand before modern salaries and safety standards.',[
    c('CREATE A PERMANENT FUND','Guarantee support beyond your tenure.',{cashM:-20,fanTrust:11,legacy:12,leagueInfluence:3}),c('MATCH DONATIONS','Share the responsibility with fans and sponsors.',{cashM:-8,fanTrust:6,legacy:6}),c('REFER THEM TO THE LEAGUE','Keep team finances separate.',{cashM:3,fanTrust:-10,legacy:-7})
  ]),
  s('camp-holdout','TRAINING CAMP · EMPTY LOCKER','YOUR CAPTAIN NEVER ARRIVED','The defensive captain begins a holdout with two years left on his contract. Younger teammates are already discussing their own deals.','A concession solves one problem and may create ten more.',[
    c('NEGOTIATE A NEW DEAL','Reward elite performance.',{cashM:-25,staffMorale:8,approval:4}),c('ADD INCENTIVES ONLY','Offer upside without rewriting everything.',{cashM:-8,staffMorale:4,leagueInfluence:2}),c('FINE EVERY DAY','Enforce the contract.',{cashM:3,staffMorale:-9,approval:-5})
  ],['pre']),
  s('rookie-hazing','LOCKER ROOM · INTERNAL REPORT','THE ROOKIE RITUAL WENT TOO FAR','A rookie reports that veterans humiliated him during a team tradition. Coaches knew and said nothing.','The locker room calls it bonding. The rookie calls it abuse.',[
    c('END THE TRADITION','Discipline veterans and coaches.',{staffMorale:-3,approval:9,fanTrust:8,legacy:6}),c('USE A PLAYER COUNCIL','Let captains rebuild the tradition.',{staffMorale:7,approval:4,legacy:3}),c('KEEP IT INTERNAL','Avoid a public confrontation.',{staffMorale:3,approval:-8,fanTrust:-7})
  ],['pre','early']),
  s('stadium-workers','STADIUM GATES · STRIKE NOTICE','GAME DAY WORKERS WALK OUT','Security, food-service and cleaning crews reject the final contract offer before a sold-out home game.','You can settle, cancel services or bring in replacement workers.',[
    c('SETTLE TODAY','Raise wages and reopen every gate.',{cashM:-16,approval:12,fanTrust:10,legacy:7}),c('MEDIATE FOR 48 HOURS','Delay the dispute and prepare backups.',{cashM:-5,approval:3,fanTrust:2}),c('HIRE REPLACEMENTS','Keep the game fully operational.',{cashM:4,approval:-13,fanTrust:-11,legacy:-6})
  ]),
  s('coach-extension','OWNER OFFICE · AGENT WAITING','THE COACH WANTS FIVE YEARS','Your coach has one year left and demands a market-setting extension before the next game.','A long commitment creates stability—or an expensive firing later.',[
    c('GIVE FIVE YEARS','Make him the face of the plan.',{cashM:-26,staffMorale:12,approval:5,legacy:3}),c('OFFER TWO YEARS','Reward progress without surrendering flexibility.',{cashM:-11,staffMorale:5,approval:2}),c('WAIT UNTIL JANUARY','Make the season prove it.',{staffMorale:-7,approval:-3})
  ],['mid','late']),
  s('gm-firing-rumor','EXECUTIVE HALLWAY · LEAKED TEXT','YOUR GM THINKS HE IS FIRED','A text from an ownership advisor reaches your GM before you have made any decision.','Silence will poison the front office. A promise may tie your hands.',[
    c('GUARANTEE HIS JOB','Restore authority immediately.',{staffMorale:10,approval:-2,legacy:2}),c('ANNOUNCE A SEASON REVIEW','Make the process public and fair.',{staffMorale:2,approval:5}),c('BEGIN THE SEARCH','Treat the leak as the start of change.',{cashM:-5,staffMorale:-11,approval:4})
  ],['mid','late']),
  s('fan-equity','BUSINESS SUMMIT · UNUSUAL PROPOSAL','FANS WANT A PIECE OF THE TEAM','A supporter group proposes non-voting community shares to fund stadium improvements.','The shares build connection but create thousands of permanent stakeholders.',[
    c('LAUNCH COMMUNITY SHARES','Give fans a lasting symbolic stake.',{cashM:35,fanTrust:15,approval:10,legacy:9}),c('CREATE A SEASON-TICKET COUNCIL','Offer influence without equity.',{cashM:5,fanTrust:8,approval:6}),c('REJECT THE IDEA','Keep ownership private and simple.',{fanTrust:-8,approval:-5})
  ]),
  s('memorial-patch','TEAM CHAPEL · FAMILY MEETING','WHO GETS THE MEMORIAL PATCH?','Two beloved members of the franchise family die in the same month, and the uniform allows only one primary memorial.','Every choice risks making one family feel forgotten.',[
    c('HONOR BOTH EQUALLY','Redesign the uniform and field marks.',{cashM:-2,fanTrust:9,legacy:9}),c('LET THE FAMILIES DECIDE','Give the choice to those closest to them.',{approval:5,fanTrust:6,legacy:7}),c('USE A TEAM-WIDE SYMBOL','Create one mark for everyone lost.',{fanTrust:4,legacy:5})
  ]),
  s('streaming-rights','MEDIA SUMMIT · EXCLUSIVE OFFER','THE GAME MOVES BEHIND A PAYWALL','A streaming platform offers major money for exclusive rights to a rivalry game.','National reach grows while some longtime fans lose access.',[
    c('TAKE THE EXCLUSIVE','Fund football operations with the deal.',{cashM:55,leagueInfluence:7,fanTrust:-10}),c('REQUIRE A FREE LOCAL FEED','Accept less and protect the home market.',{cashM:31,fanTrust:8,approval:5}),c('KEEP IT ON BROADCAST','Choose maximum access.',{cashM:8,fanTrust:12,legacy:4})
  ]),
  s('schedule-flex','LEAGUE SCHEDULING · 12 DAYS OUT','PRIMETIME COSTS A REST DAY','The league wants to flex your rivalry game into Monday night, leaving only five days before the next matchup.','Exposure helps the brand while the football staff loses recovery time.',[
    c('ACCEPT PRIMETIME','Take the spotlight and revenue.',{cashM:12,leagueInfluence:6,staffMorale:-6}),c('FIGHT THE FLEX','Protect preparation and recovery.',{staffMorale:9,leagueInfluence:-5,fanTrust:3}),c('ASK TO MOVE BOTH GAMES','Force a broader schedule solution.',{leagueInfluence:2,staffMorale:5,approval:2})
  ],['mid','late']),
  s('evacuation-site','EMERGENCY CALL · CITYWIDE ORDER','THE CITY MUST EVACUATE','A regional emergency closes your stadium and practice facility for at least two weeks. Three cities offer temporary homes.','Where the franchise goes will affect players, displaced fans and an entire community.',[
    c('STAY CLOSE TO HOME','Use a smaller nearby college stadium.',{cashM:-10,fanTrust:14,staffMorale:-3,legacy:7}),c('USE A PREMIER NEUTRAL SITE','Choose the best football facilities.',{cashM:5,staffMorale:8,fanTrust:-7}),c('FOLLOW THE LEAGUE PLAN','Accept the commissioner’s location.',{leagueInfluence:6,fanTrust:-3})
  ]),
  s('equipment-failure','EQUIPMENT ROOM · 4 HOURS TO KICK','THE HELMETS DID NOT ARRIVE','A shipping failure leaves half the active roster without their custom-fitted helmets before an away game.','Generic replacements are legal but players do not trust the fit.',[
    c('DELAY DEPARTURE AND CHARTER THEM','Spend whatever it takes to deliver the gear.',{cashM:-5,staffMorale:10,approval:4}),c('USE CERTIFIED REPLACEMENTS','Keep the schedule on track.',{staffMorale:-4,approval:-2}),c('ASK TO DELAY KICKOFF','Put the problem in the league’s hands.',{leagueInfluence:-2,staffMorale:5,fanTrust:2})
  ]),
  s('player-conduct','LEGAL OFFICE · SEALED REPORT','A STARTER FACES SERIOUS ALLEGATIONS','Police confirm an investigation involving a starting player, but no charges have been filed.','Acting too quickly may deny fairness. Waiting may endanger trust.',[
    c('PLACE HIM ON PAID LEAVE','Remove him while facts develop.',{staffMorale:2,approval:7,fanTrust:6}),c('WAIT FOR THE LEAGUE','Use the established process.',{leagueInfluence:3,approval:-2,fanTrust:-3}),c('KEEP HIM ACTIVE','Presume innocence and prioritize the roster.',{staffMorale:4,approval:-9,fanTrust:-10,legacy:-5})
  ]),
  s('team-plane','AIRPORT TARMAC · 1:40 AM','THE TEAM IS STRANDED','A mechanical issue cancels the flight home after an overtime road game. The next practice is in thirty hours.','A replacement charter is available at five times the normal cost.',[
    c('BOOK THE CHARTER','Get everyone home safely and quickly.',{cashM:-4,staffMorale:10,approval:3}),c('STAY OVERNIGHT','Rest locally and travel tomorrow.',{cashM:-1,staffMorale:5}),c('SPLIT INTO COMMERCIAL FLIGHTS','Save money and scatter the roster.',{cashM:2,staffMorale:-8,approval:-3})
  ]),
  s('practice-fight','PRACTICE FIELD · CAMERAS ROLLING','TWO CAPTAINS THROW PUNCHES','A heated practice fight between offensive and defensive leaders spreads online before the session ends.','The team can use the energy—or let the fracture grow.',[
    c('BRING THEM TOGETHER','Make both captains address the team.',{staffMorale:8,approval:4}),c('SUSPEND BOTH','Apply one standard regardless of status.',{staffMorale:-2,approval:7,fanTrust:4}),c('CALL IT COMPETITION','Downplay the fight publicly.',{staffMorale:3,approval:-6,fanTrust:-4})
  ],['pre','early','mid']),
  s('concussion-review','LEAGUE REVIEW · MEDICAL VIDEO','THE SPOTTER MISSED IT','Video shows a player displaying concussion symptoms before returning for twelve plays. Your medical staff followed the sideline report they received.','Responsibility is shared, but the player deserves a clear answer.',[
    c('REQUEST INDEPENDENT REVIEW','Open every record and change protocol.',{cashM:-3,staffMorale:3,approval:9,legacy:7}),c('DEFEND YOUR STAFF','Point to the information available.',{staffMorale:7,approval:-5,fanTrust:-4}),c('REPLACE THE MEDICAL LEAD','Make immediate leadership change.',{cashM:-6,staffMorale:-5,approval:6})
  ]),
  s('retired-number','HISTORY COMMITTEE · FINAL BALLOT','TWO LEGENDS, ONE NUMBER','Two franchise icons wore the same number in different eras. Both families want it retired this season.','Choosing one may turn a celebration into a permanent feud.',[
    c('RETIRE IT FOR BOTH','Create a shared ceremony.',{cashM:-2,fanTrust:10,legacy:11}),c('HONOR EACH ERA SEPARATELY','Build two permanent stadium exhibits.',{cashM:-5,stadium:4,fanTrust:8,legacy:9}),c('KEEP THE NUMBER ACTIVE','Reserve retirement for a future vote.',{fanTrust:-6,legacy:-4})
  ]),
  s('rivalry-marketing','MARKETING ROOM · CAMPAIGN REVIEW','THE AD CROSSES THE LINE','Your rivalry campaign mocks the opposing city’s recent disaster. It tests extremely well with younger fans.','The launch is tomorrow and millions have already been spent.',[
    c('CANCEL THE CAMPAIGN','Eat the cost and apologize privately.',{cashM:-8,approval:8,fanTrust:7,legacy:4}),c('REBUILD THE CREATIVE','Keep the rivalry without the cruelty.',{cashM:-4,approval:5,fanTrust:4}),c('RUN IT ANYWAY','Bet that outrage will drive attention.',{cashM:12,approval:-12,fanTrust:-10,legacy:-6})
  ]),
  s('executive-promotion','FRONT OFFICE · SUCCESSION MEETING','THE BEST CANDIDATE MAY LEAVE','A rising executive has an outside offer to become a rival team’s general manager. Your current GM has no intention of stepping aside.','Keeping both requires a structure neither one requested.',[
    c('CREATE A PRESIDENT ROLE','Promote the executive above daily operations.',{cashM:-8,staffMorale:5,legacy:5}),c('MATCH THE OFFER','Pay more without changing titles.',{cashM:-6,staffMorale:3}),c('LET THE EXECUTIVE GO','Respect the opportunity and protect hierarchy.',{staffMorale:4,leagueInfluence:4,legacy:2})
  ],['pre','late']),
  s('suite-renovation','REVENUE OFFICE · CAPITAL PLAN','LUXURY OR LOYALTY?','The stadium budget can fund premium suites or renovate aging upper-deck bathrooms and concourses. It cannot do both this year.','One project pays faster. The other serves far more fans.',[
    c('FIX THE UPPER DECK','Invest in the majority of supporters.',{cashM:-22,stadium:9,fanTrust:13,approval:9}),c('BUILD PREMIUM SUITES','Create long-term corporate revenue.',{cashM:35,stadium:7,fanTrust:-6}),c('SPLIT THE PROJECT','Complete smaller upgrades in both areas.',{cashM:-8,stadium:6,fanTrust:5})
  ]),
  s('youth-academy','SCHOOL DISTRICT · PARTNERSHIP TABLE','FOOTBALL IS LOSING FIELDS','Youth programs are closing because equipment, insurance and field costs have doubled. Coaches ask your franchise to intervene.','A regional academy could expand access—or become an expensive branding exercise.',[
    c('BUILD A FREE ACADEMY','Cover equipment, coaching and transportation.',{cashM:-15,fanTrust:14,approval:12,legacy:11}),c('MATCH COMMUNITY FUNDING','Share ownership with local programs.',{cashM:-7,fanTrust:9,approval:7,legacy:6}),c('HOST ONE ANNUAL CAMP','Keep the commitment limited.',{cashM:-1,fanTrust:2,approval:1})
  ]),
  s('green-stadium','FACILITIES COMMITTEE · ENERGY BID','THE STADIUM CAN POWER ITSELF','A solar and battery project can cut long-term operating costs, but construction will disrupt an entire season.','The savings arrive slowly; the inconvenience starts immediately.',[
    c('BUILD THE FULL SYSTEM','Accept disruption for long-term independence.',{cashM:-40,stadium:13,approval:6,legacy:9}),c('START WITH PARKING SOLAR','Reduce risk and prove the technology.',{cashM:-15,stadium:6,approval:4,legacy:4}),c('DEFER THE PROJECT','Protect this season’s operations.',{cashM:5,approval:-3,legacy:-2})
  ],['pre']),
  s('rookie-contract-error','CONTRACT OFFICE · SIGNING DEADLINE','ONE DECIMAL CHANGED THE DEAL','A clerical error makes your first-round rookie’s bonus ten times larger in the final contract sent for signature. His agent has already accepted.','You can honor the document, challenge it or ask a nineteen-year-old to give money back.',[
    c('HONOR THE CONTRACT','Own the organization’s mistake.',{cashM:-18,staffMorale:9,fanTrust:8,legacy:6}),c('NEGOTIATE A CORRECTION','Offer guaranteed incentives in exchange.',{cashM:-7,staffMorale:4,leagueInfluence:2}),c('VOID THE AGREEMENT','Use the technical error and start over.',{cashM:2,staffMorale:-10,approval:-8,legacy:-5})
  ],['pre']),
  s('veteran-retirement','LOCKER ROOM · EMPTY STADIUM','YOUR CAPTAIN IS DONE','After a win, your longest-tenured player tells you privately that tonight was his final game. The team is still alive in the playoff race.','Announcing it could inspire the roster or turn every week into a farewell tour.',[
    c('KEEP IT PRIVATE','Let the captain choose the moment.',{staffMorale:10,legacy:6}),c('TELL THE TEAM ONLY','Use the truth inside the building.',{staffMorale:8,approval:2,legacy:5}),c('PLAN THE FAREWELL NOW','Give fans a chance to celebrate him.',{fanTrust:12,approval:8,staffMorale:3,legacy:10})
  ],['late']),
  s('assistant-strike','COACHING OFFICES · MIDNIGHT','THE ASSISTANTS WANT EQUAL PAY','Position coaches discover large pay gaps between similar roles and threaten a coordinated resignation after Sunday.','The head coach calls it disloyal. The assistants call it overdue.',[
    c('STANDARDIZE THE PAY SCALE','Correct the gaps across the staff.',{cashM:-9,staffMorale:13,approval:5}),c('REVIEW EACH CONTRACT','Make targeted adjustments after the season.',{cashM:-3,staffMorale:4}),c('REPLACE THE ORGANIZERS','Protect management authority.',{cashM:-5,staffMorale:-14,approval:-7})
  ],['mid','late']),
  s('mascot-injury','GAME PRESENTATION · INCIDENT REPORT','THE STUNT WENT WRONG','A halftime stunt injures the longtime mascot performer in front of a packed stadium. The vendor says the performer ignored instructions.','Fans want answers while lawyers tell everyone to stay silent.',[
    c('COVER EVERY EXPENSE','Support the performer before assigning blame.',{cashM:-3,fanTrust:10,approval:8}),c('PAUSE ALL STUNTS','Investigate and redesign game presentation.',{cashM:-1,fanTrust:5,stadium:2}),c('BLAME THE VENDOR','Protect the franchise publicly.',{cashM:2,fanTrust:-6,approval:-4})
  ]),
  s('owner-access','SECURITY OFFICE · CREDENTIAL REVIEW','YOUR FAMILY BYPASSED SECURITY','A relative used your name to enter restricted football areas and argued with staff who tried to stop them.','Protecting family privilege will tell every employee whose rules matter.',[
    c('REVOKE THE CREDENTIAL','Back the staff publicly and privately.',{staffMorale:12,approval:7,legacy:5}),c('ISSUE A FORMAL WARNING','Give family one final chance.',{staffMorale:4,approval:2}),c('DISCIPLINE SECURITY','Treat the enforcement as the problem.',{staffMorale:-14,approval:-8,legacy:-6})
  ]),
  s('trade-physical','MEDICAL REVIEW · TRADE DEADLINE','THE TRADE TARGET FAILED HIS PHYSICAL','The star you agreed to acquire has a condition your doctors believe will shorten his career. The selling team says he has never missed a game.','Canceling protects the franchise and may destroy your reputation with the player.',[
    c('CANCEL THE TRADE','Trust your medical staff.',{staffMorale:7,leagueInfluence:-2,approval:-3}),c('RENEGOTIATE THE PRICE','Accept the risk for fewer assets.',{cashM:-8,leagueInfluence:5,approval:4}),c('HONOR THE ORIGINAL DEAL','Stand behind your agreement.',{cashM:-20,staffMorale:-3,fanTrust:7,legacy:5})
  ],['mid']),
  s('playoff-hosting','STADIUM OFFICE · CALENDAR CONFLICT','THE CONCERT OWNS THE DATE','A stadium contract guarantees a massive concert the night before a potential home playoff game. Moving it will trigger a crushing penalty.','The field, the fans and the league need an answer now.',[
    c('MOVE THE CONCERT','Protect the playoff stage.',{cashM:-20,fanTrust:12,approval:8,stadium:2}),c('BUILD AN OVERNIGHT CONVERSION','Pay for crews to host both.',{cashM:-11,stadium:5,staffMorale:-2}),c('ASK TO PLAY SATURDAY','Put the competitive schedule at risk.',{leagueInfluence:-4,cashM:5,fanTrust:-3})
  ],['late']),
  s('captain-vote','LOCKER ROOM · LEADERSHIP COUNCIL','THE PLAYERS REJECT YOUR CAPTAIN','The roster votes a respected veteran out of the captain group after he criticized younger teammates. The coaches want to overrule them.','Authority and player democracy are now in direct conflict.',[
    c('HONOR THE PLAYER VOTE','Let the room choose its leaders.',{staffMorale:10,approval:3,legacy:3}),c('BACK THE COACHES','Keep leadership decisions with staff.',{staffMorale:-6,approval:2}),c('ADD A NEW CAPTAIN WITHOUT REMOVING HIM','Expand the group and avoid a direct loss.',{staffMorale:3,approval:-2})
  ],['early','mid']),
  s('owner-apology','POSTGAME PODIUM · LIVE MICROPHONE','YOUR WORDS BECAME THE STORY','In frustration, you blame the roster for a loss while a microphone is still live. Players hear the clip before you leave the stadium.','The next statement can repair trust or deepen the divide.',[
    c('APOLOGIZE WITHOUT EXCUSES','Take responsibility in front of everyone.',{staffMorale:9,approval:5,legacy:4}),c('MEET WITH CAPTAINS FIRST','Repair the room before addressing media.',{staffMorale:7,approval:2}),c('DOUBLE DOWN','Demand accountability from the roster.',{staffMorale:-12,approval:-6,fanTrust:-5})
  ],['early','mid','late'])
];

export type OwnerStoryContext={abbr:string;season:number;week:number;wins:number;losses:number;usedDecisionIds:string[];approval:number;staffMorale:number;leagueInfluence:number;legacy:number;stadium:number;fanTrust:number;cashM:number};

export const ownerStoryPhase=(week:number):OwnerStoryPhase=>week===0?'pre':week<=5?'early':week<=12?'mid':'late';

const hash=(value:string)=>{let out=2166136261;for(let i=0;i<value.length;i++){out^=value.charCodeAt(i);out=Math.imul(out,16777619);}return out>>>0;};

const legacyDecision=(ctx:OwnerStoryContext):OwnerDecision=>{
  const metrics=[['FAN TRUST',ctx.fanTrust,'fanTrust'],['STAFF MORALE',ctx.staffMorale,'staffMorale'],['APPROVAL',ctx.approval,'approval'],['STADIUM',ctx.stadium,'stadium'],['LEAGUE POWER',ctx.leagueInfluence,'leagueInfluence']] as const;
  const weakest=[...metrics].sort((a,b)=>a[1]-b[1])[0];
  const strongest=[...metrics].sort((a,b)=>b[1]-a[1])[0];
  const id=`legacy-${ctx.abbr}-${ctx.season}-${ctx.week}-${ctx.usedDecisionIds.length}`;
  return s(id,`OWNER LEGACY · SEASON ${ctx.season}`,'THE FRANCHISE HAS A NEW CROSSROADS',`Years of your decisions have made ${strongest[0].toLowerCase()} a strength, but ${weakest[0].toLowerCase()} is now demanding attention. Your leadership team presents three competing plans for the next era.`,`This is a one-time legacy decision built from your actual career after all ${OWNER_DECISIONS.length} authored stories were completed.`,[
    c(`REBUILD ${weakest[0]}`,'Invest directly in the franchise’s weakest area.',{[weakest[2]]:14,cashM:-18,legacy:4}),
    c(`LEVERAGE ${strongest[0]}`,'Use your strongest advantage to keep pushing forward.',{[strongest[2]]:8,legacy:7,cashM:-8}),
    c('START A NEW FIVE-YEAR PLAN','Spread resources across the entire organization.',{approval:5,staffMorale:5,fanTrust:5,stadium:3,leagueInfluence:3,cashM:-25,legacy:6})
  ]);
};

export const ownerDecisionById=(id:string)=>OWNER_DECISIONS.find(decision=>decision.id===id);

export const nextOwnerDecision=(ctx:OwnerStoryContext):OwnerDecision=>{
  const used=new Set(ctx.usedDecisionIds);
  const unseen=OWNER_DECISIONS.filter(decision=>!used.has(decision.id));
  if(!unseen.length)return legacyDecision(ctx);
  const phase=ownerStoryPhase(ctx.week);
  const phaseMatches=unseen.filter(decision=>!decision.phases||decision.phases.includes(phase));
  const pool=phaseMatches.length?phaseMatches:unseen;
  const index=hash(`${ctx.abbr}:${ctx.season}:${ctx.week}:${ctx.wins}:${ctx.losses}:${used.size}`)%pool.length;
  return pool[index];
};

export const unseenOwnerStoryCount=(usedDecisionIds:string[])=>OWNER_DECISIONS.filter(decision=>!usedDecisionIds.includes(decision.id)).length;
