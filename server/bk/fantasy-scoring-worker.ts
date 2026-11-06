import {scoringContentHash,validateScoringSnapshot,type CanonicalScoringSnapshot} from './fantasy-canonical-scoring.js';

type RpcDatabase={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
/** Future worker boundary. The deployed schedule-only route does not import this. */
export async function commitValidatedFantasySnapshot(db:RpcDatabase,snapshot:CanonicalScoringSnapshot,nowMs=Date.now()){
 const canonical=validateScoringSnapshot(snapshot,nowMs);
 // One RPC is the entire write boundary. Never retry an unknown-commit failure.
 // Replaying the same completed snapshot later is safe via its content receipt.
 const result=await db.rpc('commit_ball_knower_fantasy_scoring_snapshot',{p_snapshot:canonical,p_content_hash:scoringContentHash(canonical)});
 if(result.error)throw Error('atomic_scoring_commit_unavailable');
 if(!result.data||typeof result.data!=='object')throw Error('atomic_scoring_receipt_unavailable');
 return result.data;
}

import {fetchBoundedText} from './bounded-fetch.js';
import {adaptTank01ScoringSnapshot,type Tank01GameContext,type Tank01Identity,type Tank01ScoringContract} from './tank01-scoring-adapter.js';
import {TANK01_HOST} from './scoring-provider-coverage.js';
type ScoringWork={contract:Tank01ScoringContract;games:{game:Tank01GameContext;identities:Tank01Identity[]}[]};
/** Prepared ingestion worker, deliberately absent from the deployed API route.
 * Only an approved source contract can return work; at most two boxes are read.
 * A failed game emits one safe code and commits nothing for that game. */
export async function runValidatedTank01Scoring(db:RpcDatabase,options:{contractId:string;providerKey:string;fetchImpl?:typeof fetch;now?:()=>number;log?:(event:Record<string,unknown>)=>void}){
 if(!options.providerKey)throw Error('scoring_provider_unavailable');
 const loaded=await db.rpc('claim_ball_knower_fantasy_scoring_work',{p_contract_id:options.contractId});
 if(loaded.error||!loaded.data||typeof loaded.data!=='object')throw Error('approved_scoring_work_unavailable');
 const work=loaded.data as ScoringWork;
 if(!work.contract||work.contract.id!==options.contractId||!Array.isArray(work.games)||work.games.length>2)throw Error('invalid_scoring_work');
 const fetcher=options.fetchImpl??fetch,clock=options.now??Date.now;
 const outcomes=await Promise.all(work.games.map(async({game,identities})=>{
  try{
   const url=new URL(`https://${TANK01_HOST}/getNFLBoxScore`);url.searchParams.set('gameID',game.providerGameId);url.searchParams.set('playByPlay','false');url.searchParams.set('fantasyPoints','false');
   const response=await fetchBoundedText(url.href,{maxBytes:4_000_000,timeoutMs:8_000,fetchImpl:async(input,init)=>{
    if(new URL(String(input)).origin!==`https://${TANK01_HOST}`)throw Error('invalid_provider_origin');
    return fetcher(input,{...init,headers:{Accept:'application/json','x-rapidapi-key':options.providerKey,'x-rapidapi-host':TANK01_HOST}});
   }});
   const payload=JSON.parse(response.text);
   if(!payload||typeof payload!=='object'||payload.error||Number(payload.statusCode)>=400)throw Error('invalid_provider_payload');
   const snapshot=adaptTank01ScoringSnapshot({body:payload.body??payload,game,identities,contract:work.contract,retrievedAt:new Date(clock()).toISOString(),httpLastModified:response.sourceUpdatedAt,nowMs:clock()});
   const receipt=await commitValidatedFantasySnapshot(db,snapshot,clock());
   return {status:'committed',receipt};
  }catch{
   // Never print raw upstream/DB errors, provider data or credentials.
   options.log?.({code:'validated_scoring_game_unavailable',source:'tank01',writesCertified:false});
   return {status:'unavailable'};
  }
 }));
 return {gamesRequested:work.games.length,outcomes};
}
