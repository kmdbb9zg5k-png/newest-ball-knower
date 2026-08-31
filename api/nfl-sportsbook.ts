import{fetchCanonicalPredictionGames}from'../server/nflPredictionFeed';

const sendUnavailable=(res:any,reason:string)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.status(200).json({games:[],available:false,warning:reason});
};

export default async function handler(req:any,res:any){
  try{
    const rows=await fetchCanonicalPredictionGames();
    const now=Date.now();
    const requestedIds=new Set(String(req?.query?.gameIds||'').split(',').filter(Boolean));
    const requestedRows=rows.filter(game=>requestedIds.has(game.id));
    const currentRows=rows
      .filter(game=>{const when=game.kickoffAt?Date.parse(game.kickoffAt):NaN;return!Number.isFinite(when)||when>=now-7*24*60*60*1000})
      .sort((a,b)=>{const av=a.kickoffAt?Date.parse(a.kickoffAt):Number.MAX_SAFE_INTEGER;const bv=b.kickoffAt?Date.parse(b.kickoffAt):Number.MAX_SAFE_INTEGER;return av-bv})
      .slice(0,50);
    const relevant=[...requestedRows,...currentRows.filter(game=>!requestedIds.has(game.id))];
    const games=relevant.map(game=>{
      const kickoffMs=game.kickoffAt?Date.parse(game.kickoffAt):NaN;
      return{
        id:game.id,
        date:game.kickoffAt,
        status:game.final?'Final':game.status||(Number.isFinite(kickoffMs)&&kickoffMs<=now?'Live':'Scheduled'),
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
      };
    });
    if(!games.length)return sendUnavailable(res,'No current NFL games or lines are available');
    res.setHeader('Cache-Control','public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({games,available:true});
  }catch(error:any){
    console.warn('nfl-picks-handler-degraded',String(error?.message||error));
    return sendUnavailable(res,'NFL scoreboard feed temporarily unavailable');
  }
}
