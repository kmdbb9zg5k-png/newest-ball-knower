import{fetchCanonicalPredictionGames}from'../server/nflPredictionFeed.js';
import{createPredictionGameResolver}from'../server/predictionIdentity.js';

const sendUnavailable=(res:any)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.status(200).json({games:[],available:false,linesAvailable:false,warning:'NFL matchups are temporarily unavailable.'});
};

export function createSportsbookHandler({fetchGames=fetchCanonicalPredictionGames,now:clock=Date.now}:{fetchGames?:()=>Promise<any[]>;now?:()=>number}={}){
return async function handler(req:any,res:any){
  const method=req.method||'GET';
  // POST only transports a large saved-history lookup. It never writes picks.
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(!['GET','POST'].includes(method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'});}
  let requestedIds:Set<string>;let references:any[]=[];
  try{
    let input:any=method==='POST'?req.body:req.query||{};
    if(typeof input==='string'){if(input.length>256_000)throw Error('size');input=JSON.parse(input);}
    if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>256_000)throw Error('shape');
    const ids=method==='POST'?(input.gameIds??[]):String(input.gameIds||'').split(',').filter(Boolean);
    if(!Array.isArray(ids)||ids.length>500||ids.some(value=>typeof value!=='string'||value.length>120))throw Error('ids');
    requestedIds=new Set(ids.map((value:string)=>value.trim()).filter(Boolean));
    let parsed=input.gameRefs??[];
    if(typeof parsed==='string')parsed=JSON.parse(parsed);
    if(!Array.isArray(parsed)||parsed.length>500||parsed.some(value=>!value||typeof value!=='object'||Array.isArray(value)))throw Error('refs');
    references=parsed.map(value=>({gameId:String(value.gameId||'').slice(0,120),awayTeam:String(value.awayTeam||'').slice(0,120),homeTeam:String(value.homeTeam||'').slice(0,120),kickoffAt:String(value.kickoffAt||'').slice(0,80)}));
  }catch{return res.status(400).json({error:'Invalid saved matchups'});}
  try{
    const rows:any=await fetchGames();
    const now=clock();
    const resolve=createPredictionGameResolver(rows);
    const requestedCanonicalIds=new Set([...requestedIds].flatMap(gameId=>{const match=resolve({gameId});return match.game?[match.game.id]:[]}));
    for(const reference of references){const match=resolve(reference);if(match.game)requestedCanonicalIds.add(match.game.id);}
    const requestedRows=rows.filter((game:any)=>requestedCanonicalIds.has(game.id));
    const currentRows=rows
      .filter((game:any)=>{const when=game.kickoffAt?Date.parse(game.kickoffAt):game.scheduleDate?Date.parse(`${game.scheduleDate}T23:59:59Z`):NaN;return!Number.isFinite(when)||when>=now-7*24*60*60*1000})
      .sort((a:any,b:any)=>{const av=a.kickoffAt?Date.parse(a.kickoffAt):a.scheduleDate?Date.parse(`${a.scheduleDate}T23:59:59Z`):Number.MAX_SAFE_INTEGER;const bv=b.kickoffAt?Date.parse(b.kickoffAt):b.scheduleDate?Date.parse(`${b.scheduleDate}T23:59:59Z`):Number.MAX_SAFE_INTEGER;return av-bv})
      .slice(0,50);
    const relevant=[...requestedRows,...currentRows.filter((game:any)=>!requestedCanonicalIds.has(game.id))];
    const games=relevant.map((game:any)=>{
      const kickoffMs=game.kickoffAt?Date.parse(game.kickoffAt):NaN;
      const lineAvailable=game.homeSpread!=null||game.awaySpread!=null||game.total!=null;
      return{
        id:game.id,
        aliases:Array.isArray(game.aliases)?game.aliases:[],
        scheduleDate:game.scheduleDate||null,
        season:game.season||null,
        week:game.week||null,
        seasonType:game.seasonType||null,
        date:Number.isFinite(kickoffMs)?new Date(kickoffMs).toISOString():null,
        status:game.final?'Final':game.status||(Number.isFinite(kickoffMs)&&kickoffMs<=now?'Status unavailable':'Scheduled'),
        away:game.away,
        home:game.home,
        awayAbbr:game.awayAbbr,
        homeAbbr:game.homeAbbr,
        details:game.homeSpread==null?null:`${game.home} ${game.homeSpread>0?'+':''}${game.homeSpread}`,
        spread:null,
        homeSpread:game.homeSpread,
        awaySpread:game.awaySpread,
        overUnder:game.total,
        awayScore:game.awayScore,
        homeScore:game.homeScore,
        lineAvailable,
        oddsSource:game.oddsSource||null,
      };
    });
    const linesAvailable=games.some((game:any)=>game.lineAvailable);
    // These are periodically published dataset lines, not live bookmaker prices.
    // Preserve the upstream snapshot timestamp even on a warm cache hit.
    if(method==='GET')res.setHeader('Cache-Control','public, s-maxage=60, max-age=0');
    return res.status(200).json({
      games,
      available:true,
      linesAvailable,
      warning:!games.length||linesAvailable?null:'NFL schedule is available, but spread and total lines are not posted right now.',
      fetchedAt:rows.fetchedAt||null,
      completionAvailable:rows.completionAvailable===true,scorePublicationVerified:rows.scorePublicationVerified===true,
      completionFetchedAt:rows.completionFetchedAt||null,completionSourceUpdatedAt:rows.completionSourceUpdatedAt||null,
      sourceUpdatedAt:rows.sourceUpdatedAt||null,source:rows.source||'nflverse',freshness:'periodic',live:false,
      attribution:rows.attribution||null,license:rows.license||null,licenseUrl:rows.licenseUrl||null,
    });
  }catch(error:any){
    console.warn('nfl-picks-handler-degraded',String(error?.message||error));
    return sendUnavailable(res);
  }
};
}
export default createSportsbookHandler();
