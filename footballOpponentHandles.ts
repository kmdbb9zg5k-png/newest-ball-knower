// Fictional arena identities only. These are not community/auth accounts.
export const FOOTBALL_OPPONENT_HANDLES = [
 'FourthDownAce','PocketPoet','RedZoneRico','GridironGhost','SundaySavage',
 'BlitzCity23','EndZoneEcho','RouteRunner7','ClutchQuarter','GoalLineGuru',
 'PhillyPhantom','SnapKing21','DeepBallDre','IronPocket','TwoMinuteTy',
 'TouchdownTrey','HuddleHero','MidnightBlitz','SidelineSage','NoPuntNate',
 'PlayActionJay','WestCoastWiz','FieldGeneral9','CoverZeroKai','TheChainMover',
 'TurboTackle','GoldenCleats','NorthsideQB','RedZoneRebel','ClockworkCam',
 'DimeDropper11','JetSweepJules','GoalPostGhost','TheAudible','ScrambleSam',
 'ThirdDownTheo','PrimeTimePat','PocketRocket8','EndZoneEnzo','BlitzBroker',
 'SundaySneak','RouteTreeRoy','IronCleats44','HailMaryMiles','YardLineYuri',
 'CrownCityCole','FastBreakFinn','ClutchCarter','DriveTimeDuke','VictoryVince'
] as const;
export function pickFootballOpponentHandle(): string {
 let previous='';
 try{previous=sessionStorage.getItem('bk-arena-last-opponent')||'';}catch{}
 const pool=FOOTBALL_OPPONENT_HANDLES.filter(handle=>handle!==previous);
 const handle=pool[crypto.getRandomValues(new Uint32Array(1))[0]%pool.length];
 try{sessionStorage.setItem('bk-arena-last-opponent',handle);}catch{}
 return handle;
}
