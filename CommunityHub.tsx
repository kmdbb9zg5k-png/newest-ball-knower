import React,{useCallback,useEffect,useRef,useState} from 'react';
import './communityArena.css';
import {useCommunityResource} from './useCommunityResource';
import {matchSecondsLeft,messageDay} from './communityState';
import {BroadcastStage} from './BroadcastScene';
import {useBallKnower} from './BallKnowerContext';
import {CommunitySafetySettings,MessageSafety,useCommunitySafety} from './CommunitySafety';
import {fetchProgressionProfile} from './progressionCloud';
import {cancelH2H,fetchCommunityHome,fetchDirectMessages,fetchGlobalMessages,fetchH2HMatch,finishH2H,postGlobalMessage,removeFriend,respondFriendRequest,respondH2H,searchCommunityUsers,sendDirectMessage,sendFriendRequest,startH2H,submitH2HAnswer,subscribeCommunity,type CommunityFriend,type CommunityHome,type CommunityPerson,type CommunitySearchPerson,type H2HMatch} from './communityCloud';
import {Brain,ChevronRight,Clock3,Globe2,Loader2,LockKeyhole,MessageCircle,RefreshCcw,Search,Send,ShieldCheck,Swords,Trophy,UserPlus,Users,X} from 'lucide-react';

type View='home'|'rankings'|'h2h'|'chat'|'friends'|'messages';
type Props={onOpenAuth:()=>void;onOpenTrivia:()=>void;onViewLocker:(person:CommunityPerson)=>void};
const card='rounded-2xl border border-white/10 bg-[#0b1016]/90 shadow-[0_20px_60px_rgba(0,0,0,.28)]';
const button='arena-button min-h-11 rounded-xl border border-[#d9b43b]/35 bg-[#d9b43b]/10 px-4 text-[10px] font-black uppercase tracking-[.12em] text-[#ecd67d] disabled:cursor-not-allowed disabled:opacity-40';
const formatTime=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};
const record=(person:Pick<CommunityPerson,'h2hWins'|'h2hLosses'|'h2hTies'>)=>`${person.h2hWins}-${person.h2hLosses}${person.h2hTies?`-${person.h2hTies}`:''}`;

export const CommunityHub:React.FC<Props>=(props)=>{
  const {currentUser}=useBallKnower();
  return <CommunitySession key={`${currentUser?.id}:${currentUser?.isAnonymous}`} {...props}/>;
};
const CommunitySession:React.FC<Props>=({onOpenAuth,onOpenTrivia,onViewLocker})=>{
  const {currentUser,showToast}=useBallKnower();
  const [view,setView]=useState<View>('home');

  const [activeMatchId,setActiveMatchId]=useState('');
  const [messageFriendId,setMessageFriendId]=useState('');
  const [guestPerson,setGuestPerson]=useState<CommunityPerson|null>(null);
  const profileEnsuredFor=useRef('');
  const permanent=Boolean(currentUser&&!currentUser.isAnonymous);
  const resource=useCommunityResource<CommunityHome>(async()=>{
    if(!permanent)return fetchCommunityHome(true);
    if(profileEnsuredFor.current!==currentUser?.id){await fetchProgressionProfile(currentUser?.name);profileEnsuredFor.current=currentUser?.id||'';}
    return fetchCommunityHome();
  });
  const {data:home,loading,error,refresh:load}=resource;
  const [pending,setPending]=useState(false);const actionLock=useRef(false);
  useEffect(()=>{if(!permanent)return subscribeCommunity('public',()=>void load());
    const matches=subscribeCommunity('matches',()=>void load());
    const friends=subscribeCommunity('friends',()=>void load());
    return()=>{matches();friends();};
  },[load,permanent]);
  const act=async(work:()=>Promise<unknown>,success?:string)=>{
    if(!permanent){onOpenAuth();return;}
    if(actionLock.current)return;actionLock.current=true;setPending(true);
    try{await work();if(success)showToast(success);await load(true);}
    catch(reason){showToast(reason instanceof Error?reason.message:'That action could not be completed.');}
    finally{actionLock.current=false;setPending(false);}
  };
  const friends=home?.friends.filter(friend=>friend.status==='accepted')||[];
  const incoming=home?.friends.filter(friend=>friend.status==='pending'&&friend.direction==='incoming')||[];

  return <BroadcastStage scene="studio" page="arena" className="bk-arena min-h-[calc(100dvh-7rem)] px-3 pb-10 pt-4 sm:px-6 sm:pt-7"><div className="mx-auto max-w-5xl">
    <header className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.28em] text-[#d9b43b]">Worldwide football community</p><h1 className="mt-1 text-3xl font-black uppercase tracking-[-.04em] sm:text-5xl">BK Arena</h1><p className="mt-1 text-xs font-bold text-zinc-500">Rank. Debate. Challenge. Prove it.</p></div><button type="button" aria-label="Refresh Community" disabled={loading} onClick={()=>void load()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5"><RefreshCcw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></header>
    <nav aria-label="Community sections" className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">{([
      ['home','Arena',Globe2],['rankings','Rankings',Trophy],['h2h','H2H',Swords],['chat','Global chat',MessageCircle],['friends','Friends',UserPlus],['messages','Messages',Send],
    ] as const).map(([key,label,Icon])=><button type="button" key={key} onClick={()=>setView(key)} aria-current={view===key?'page':undefined} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-[9px] font-black uppercase tracking-[.1em] ${view===key?'border-[#d9b43b]/60 bg-[#d9b43b]/15 text-[#ecd67d]':'border-white/10 bg-[#0b1016] text-zinc-500'}`}><Icon className="h-3.5 w-3.5"/>{label}{key==='friends'&&incoming.length>0&&<span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] text-white">{incoming.length}</span>}</button>)}</nav>
    {!permanent&&<section aria-label="Guest browsing" className={`${card} mb-4 flex items-center justify-between gap-3 p-3`}><strong className="text-xs text-[#ecd67d]">Browsing as a guest</strong><button type="button" onClick={onOpenAuth} className={button}>Sign in</button></section>}
    {error&&<div role="alert" className="mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-200">{error} <button type="button" className="min-h-11 px-3 underline" onClick={()=>void load()}>Retry Community</button></div>}
    {loading&&!home?<div className={`${card} grid min-h-64 place-items-center`}><Loader2 className="h-7 w-7 animate-spin text-[#d9b43b]"/></div>:<fieldset disabled={pending} aria-busy={pending} className="min-w-0 border-0 p-0">
      {view==='home'&&<ArenaHome guest={!permanent} me={currentUser?.id||''} home={home} onView={setView} onTrivia={onOpenTrivia} onOpenMatch={setActiveMatchId}/>}
      {view==='rankings'&&<Rankings home={home} me={currentUser?.id||''} onViewLocker={person=>permanent?onViewLocker(person):setGuestPerson(person)}/>}
      {view==='chat'&&<GlobalChat readOnly={!permanent} onOpenAuth={onOpenAuth}/>}
      {view==='friends'&&!permanent&&<GuestParticipation title="Build your football circle" onOpenAuth={onOpenAuth}>Sign in to find friends, send requests and challenge your rivals.</GuestParticipation>}
      {view==='friends'&&permanent&&<Friends home={home} onViewLocker={onViewLocker} onAction={act} onMessage={id=>{setMessageFriendId(id);setView('messages')}} onChallenge={id=>void act(async()=>{await startH2H(id);setView('h2h');},'Challenge sent')}/>}
      {view==='messages'&&!permanent&&<GuestParticipation title="Private conversations" onOpenAuth={onOpenAuth}>Messages are private between accepted friends. Sign in to start a conversation.</GuestParticipation>}
      {view==='messages'&&permanent&&<Messages friends={friends} initialFriendId={messageFriendId}/>}
      {view==='h2h'&&<H2HLobby home={home} me={currentUser?.id||''} onAction={act} onOpenMatch={setActiveMatchId} onSolo={onOpenTrivia}/>}
    </fieldset>}
    {guestPerson&&<GuestPerson person={guestPerson} onClose={()=>setGuestPerson(null)} onOpenAuth={onOpenAuth}/>}
    {activeMatchId&&<H2HGame matchId={activeMatchId} me={currentUser?.id||''} onClose={()=>{setActiveMatchId('');void load()}}/>}
  </div></BroadcastStage>;
};

function ArenaHome({guest,home,me,onView,onTrivia,onOpenMatch}:{guest:boolean;home:CommunityHome|null;me:string;onView:(view:View)=>void;onTrivia:()=>void;onOpenMatch:(id:string)=>void}){
  const leader=home?.leaderboard[0];const active=home?.matches.find(match=>match.status==='active');
  const myRank=home?.leaderboard.find(person=>person.userId===me);
  const friends=home?.friends.filter(person=>person.status==='accepted').length||0;
  const invites=(home?.friends.filter(person=>person.status==='pending'&&person.direction==='incoming').length||0)+(home?.matches.filter(match=>match.status==='pending'&&match.opponentId===me).length||0);
  return <div className="space-y-4">
    <section className="arena-hero"><div className="arena-hero-content"><span className="arena-kicker">THE GAME IS BETTER TOGETHER</span><h2>YOUR PEOPLE.<br/><em>YOUR PROVING GROUND.</em></h2><p>Find your football circle. Talk your game. Settle it in the Arena.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={()=>active?onOpenMatch(active.id):onView('h2h')} className={`${button} arena-primary`}><Swords className="mr-2 inline h-4 w-4"/>{active?'Rejoin live match':'Enter H2H Arena'}</button><button type="button" onClick={()=>onView('chat')} className={button}>Join the conversation <ChevronRight className="inline h-4 w-4"/></button></div></div><div className="arena-field" aria-hidden="true"><span>BK</span><i/><i/><i/></div></section>
    {!guest&&<div className="arena-stats"><button type="button" onClick={()=>onView('rankings')}><span>Your world rank</span><strong>{myRank?`#${myRank.rank}`:'—'}</strong><small>{myRank?`${myRank.bkRating} BK Rating`:'Top 50 rankings'}</small></button><button type="button" onClick={()=>onView('friends')}><span>Your circle</span><strong>{friends}</strong><small>{friends===1?'Accepted friend':'Accepted friends'}</small></button><button type="button" onClick={()=>onView('friends')}><span>Friend requests</span><strong>{home?.friends.filter(p=>p.status==='pending'&&p.direction==='incoming').length||0}</strong><small>{invites?'Check your invitations':'Build your football circle'}</small></button></div>}
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"><button type="button" onClick={()=>onView('rankings')} className={`${card} arena-feature p-5 text-left`}><Trophy className="text-[#d9b43b]"/><span className="arena-kicker">THE STANDARD</span><h2 className="text-xl font-black uppercase">World rankings</h2><p className="mt-2 text-sm text-zinc-400">See where your football knowledge stands.</p>{leader?<div className="arena-leader"><span className="arena-avatar">01</span><span className="min-w-0 flex-1 truncate font-bold">{leader.displayName}</span><strong className="text-xl text-[#ecd67d]">{leader.bkRating}<small className="ml-1 text-[10px]">BK</small></strong></div>:<p className="mt-4 text-xs text-zinc-400">No rankings yet. Start building your legacy.</p>}</button>
    <button type="button" onClick={()=>onView('friends')} className={`${card} arena-feature p-5 text-left`}><Users className="text-[#d9b43b]"/><span className="arena-kicker">BRING YOUR RIVALS</span><h2 className="text-xl font-black uppercase">Build your circle</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Find friends by name, send a challenge, and keep the football talk going in private messages.</p><span className="mt-5 inline-flex items-center text-xs font-black uppercase text-[#ecd67d]">Find Ball Knowers <ChevronRight className="ml-2 h-4 w-4"/></span></button></div>
    <button type="button" onClick={onTrivia} aria-label="Play solo trivia instead" className={`${card} flex min-h-16 w-full items-center gap-3 p-4 text-left`}><Brain className="shrink-0 text-[#d9b43b]"/><span className="flex-1"><strong className="block text-sm">Play solo trivia instead</strong><span className="text-xs text-zinc-400">Sharpen your knowledge before the next showdown.</span></span><ChevronRight className="shrink-0"/></button>
  </div>;
}

function Rankings({home,me,onViewLocker}:{home:CommunityHome|null;me:string;onViewLocker:(person:CommunityPerson)=>void}){
  const [query,setQuery]=useState('');const people=home?.leaderboard||[];
  const visible=people.filter(person=>person.displayName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const mine=people.find(person=>person.userId===me);
  return <section className={`${card} overflow-hidden`}>
    <header className="border-b border-white/10 p-5"><p className="arena-kicker">Verified progression · Top 50</p><h2 className="mt-2 text-2xl font-black uppercase">Worldwide BK Rating</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Football IQ, GM, Predictions, Trivia, Agent and Owner progression build your BK Rating. H2H has its own competitive rating.</p></header>
    {people.length>0&&<div className="grid grid-cols-3 gap-2 border-b border-white/10 p-3 sm:gap-4 sm:p-5">{people.slice(0,3).map(person=><button type="button" key={person.userId} onClick={()=>onViewLocker(person)} className={`min-w-0 rounded-2xl border p-3 text-center ${person.rank===1?'border-[#d9b43b]/40 bg-[#d9b43b]/10':'border-white/10 bg-white/[.02]'}`}><span className="block text-[10px] font-black uppercase tracking-wider text-[#ecd67d]">#{person.rank}</span><span className="arena-avatar mx-auto my-3">{person.displayName.slice(0,2).toUpperCase()}</span><strong className="block truncate text-xs" title={person.displayName}>{person.displayName}</strong><span className="mt-2 block text-2xl font-black tabular-nums text-[#ecd67d]">{person.bkRating}<small className="ml-1 text-[9px]">BK</small></span></button>)}</div>}
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4"><label className="sr-only" htmlFor="arena-rank-search">Search top 50</label><input id="arena-rank-search" className="arena-input min-w-0 flex-1" placeholder="Search top 50…" value={query} onChange={event=>setQuery(event.target.value)}/>{mine&&<button type="button" onClick={()=>onViewLocker(mine)} className={button}>You · #{mine.rank}</button>}</div>
    <ol>{visible.map(person=><li key={person.userId} className={`flex min-h-20 items-center gap-3 border-b border-white/5 px-4 ${person.userId===me?'bg-[#d9b43b]/10':''}`}><span className={`w-8 shrink-0 text-center text-sm font-black ${person.rank<=3?'text-[#ecd67d]':'text-zinc-400'}`}>#{person.rank}</span><button type="button" onClick={()=>onViewLocker(person)} className="min-h-14 min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{person.displayName}{person.userId===me?' · You':''}</strong><span className="mt-1 block text-[10px] text-zinc-400">H2H {record(person)} · {person.h2hRating} RTG</span></button><strong className="shrink-0 text-xl tabular-nums text-[#ecd67d]">{person.bkRating}<small className="ml-1 text-[8px] text-zinc-400">BK</small></strong></li>)}</ol>
    {!visible.length&&<EmptyState icon={Trophy} title={query?'No matching managers':'The rankings start here'}>{query?'Try another name in the top 50.':'Build your verified progression to join the leaderboard.'}</EmptyState>}
  </section>;
}

function EmptyState({icon:Icon=MessageCircle,title,children}:{icon?:typeof MessageCircle;title:string;children:React.ReactNode}){
  return <div className="arena-empty"><Icon className="mx-auto mb-3 h-8 w-8 text-[#d9b43b]"/><h3 className="text-base font-black text-zinc-200">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-400">{children}</p></div>;
}

function GuestPerson({person,onClose,onOpenAuth}:{person:CommunityPerson;onClose:()=>void;onOpenAuth:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} aria-label="Community manager" onCancel={event=>{event.preventDefault();onClose();}} className="bk-arena m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-[#d9b43b]/35 bg-[#0b1016] p-5 text-white backdrop:bg-black/70"><div className="flex items-center justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-black">{person.displayName}</h2><button type="button" aria-label="Close manager" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center"><X/></button></div><p className="mt-4 text-3xl font-black text-[#ecd67d]">{person.bkRating} <span className="text-sm">BK Rating</span></p><p className="mt-3 text-sm text-zinc-300">H2H record {record(person)} · {person.h2hRating} RTG</p><p className="mt-4 text-xs leading-5 text-zinc-400">Sign in to add friends, message and challenge other Ball Knowers.</p><button type="button" onClick={()=>{onClose();onOpenAuth();}} className={`${button} mt-4 w-full`}>Sign in to participate</button></dialog>;
}

function GuestParticipation({title,children,onOpenAuth}:{title:string;children:React.ReactNode;onOpenAuth:()=>void}){
  return <section className={`${card} p-5`}><EmptyState icon={LockKeyhole} title={title}>{children}</EmptyState><button type="button" onClick={onOpenAuth} className={`${button} w-full`}>Sign in to participate</button></section>;
}

function GlobalChat({readOnly,onOpenAuth}:{readOnly:boolean;onOpenAuth:()=>void}){
  const safety=useCommunitySafety();
  return <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><Conversation safety={safety} readOnly={readOnly} onOpenAuth={onOpenAuth}/><aside className={`${card} h-fit p-4`}><ShieldCheck className="mb-3 h-6 w-6 text-[#d9b43b]"/><h3 className="text-sm font-black uppercase">Good rivals. Good football.</h3><p className="mt-2 text-sm leading-6 text-zinc-400">Keep it football-focused. Slurs and profanity are censored. Threats are rejected. {readOnly?'Sign in to report abuse or block a manager.':'Use Report / Block on any message to flag abuse or stop contact.'}</p></aside></div>;
}

function Conversation({friend,safety,readOnly=false,onOpenAuth}:{friend?:CommunityFriend;safety:ReturnType<typeof useCommunitySafety>;readOnly?:boolean;onOpenAuth?:()=>void}){
  const {currentUser,showToast}=useBallKnower();
  const {data,loading,error,refresh}=useCommunityResource(()=>friend?fetchDirectMessages(friend.userId):fetchGlobalMessages(readOnly));
  const [body,setBody]=useState('');const [sending,setSending]=useState(false);const sendLock=useRef(false);
  const [sendError,setSendError]=useState('');const [atBottom,setAtBottom]=useState(true);
  const scroll=useRef<HTMLDivElement>(null);const stick=useRef(true);const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>subscribeCommunity(readOnly?'public':'messages',()=>void refresh()),[refresh,readOnly]);
  const messages=(data||[]).filter(message=>!safety.isBlocked(message.authorId));
  const lastId=messages.at(-1)?.id;
  useEffect(()=>{if(stick.current&&scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;},[lastId,loading]);
  const send=async()=>{
    if(readOnly){onOpenAuth?.();return;}
    const next=body.trim();if(!next||sendLock.current||safety.isBlocked(friend?.userId))return;
    sendLock.current=true;setSending(true);setSendError('');
    try{
      if(friend)await sendDirectMessage(friend.userId,next);else await postGlobalMessage(next);
      if(!alive.current)return;
      setBody('');stick.current=true;setAtBottom(true);await refresh(true);
    }catch(reason){if(alive.current)setSendError(reason instanceof Error?reason.message:'Message could not send. Try again.');}
    finally{sendLock.current=false;if(alive.current)setSending(false);}
  };
  const names=Object.fromEntries((data||[]).map(message=>[message.authorId,message.displayName||friend?.displayName||'Ball Knower']));
  return <section className={`${card} arena-conversation`} aria-label={friend?`Conversation with ${friend.displayName}`:'Global chat'}>
    <header className="flex min-w-0 items-center gap-3 border-b border-white/10 p-4"><span className="arena-avatar">{friend?friend.displayName.slice(0,2).toUpperCase():<Globe2 className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-black uppercase">{friend?.displayName||'Global chat'}</h2><p className="mt-1 text-[10px] text-zinc-400">{friend?'Private · accepted friends only':'Text only · public · moderated'}</p></div><button type="button" onClick={()=>void refresh()} aria-label="Refresh messages" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10"><RefreshCcw className="h-4 w-4"/></button></header>
    {error&&<div role="alert" className="border-b border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200">{error} <button type="button" className="min-h-11 px-2 underline" onClick={()=>void refresh()}>Retry messages</button></div>}
    <div ref={scroll} className="arena-message-scroll" role="log" aria-label="Messages" aria-live="polite" aria-busy={loading} onScroll={()=>{const box=scroll.current;if(box){stick.current=box.scrollHeight-box.scrollTop-box.clientHeight<80;setAtBottom(stick.current);}}}>
      {loading?<div role="status" className="grid min-h-52 place-items-center"><Loader2 aria-label="Loading messages" className="animate-spin text-[#d9b43b]"/></div>:!messages.length&&!error?<EmptyState title={friend?'Start the conversation':'First one in the huddle'}>{friend?'Say hello, talk matchups, or set up your next rivalry.':'Drop your football take and get the conversation started.'}</EmptyState>:messages.map((message,index)=><React.Fragment key={message.id}>
        {(index===0||messageDay(message.createdAt)!==messageDay(messages[index-1].createdAt))&&<p className="py-3 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">{messageDay(message.createdAt)}</p>}
        <article className={`arena-bubble ${message.authorId===currentUser?.id?'arena-bubble-mine':''}`}>
          <div className="flex min-w-0 items-baseline justify-between gap-3"><strong className="min-w-0 truncate text-xs text-[#ecd67d]">{message.authorId===currentUser?.id?'You':message.displayName||friend?.displayName||'Ball Knower'}</strong><time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()} className="shrink-0 text-[10px] text-zinc-400">{formatTime(message.createdAt)}</time></div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{message.body}</p>{!readOnly&&<MessageSafety contentType={friend?'community_dm':'global_message'} contentId={message.id} authorId={message.authorId} safety={safety}/>}
        </article></React.Fragment>)}
    </div>
    {!atBottom&&<button type="button" onClick={()=>{stick.current=true;setAtBottom(true);if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;}} className={`${button} mx-auto my-2`}>Jump to latest</button>}
    {friend&&<div className="max-h-44 overflow-y-auto px-3"><CommunitySafetySettings safety={safety} names={{[friend.userId]:friend.displayName}}/></div>}
    {sendError&&<p role="alert" className="px-4 py-2 text-xs text-red-200">{sendError}</p>}
    {readOnly?<div className="arena-composer"><p className="mb-3 text-xs text-zinc-400">You’re viewing public chat. Sign in to join the conversation.</p><button type="button" onClick={onOpenAuth} className={`${button} w-full`}>Sign in to post</button></div>:<form className="arena-composer" onSubmit={event=>{event.preventDefault();void send();}}><div className="flex gap-2"><label className="sr-only" htmlFor={friend?'private-message':'global-chat-message'}>{friend?'Private message':'Global message'}</label><input id={friend?'private-message':'global-chat-message'} maxLength={friend?1000:300} value={body} disabled={sending||safety.isBlocked(friend?.userId)} onChange={event=>setBody(event.target.value)} placeholder={safety.isBlocked(friend?.userId)?'Unblock this friend to message':friend?'Message friend…':'Talk football…'} className="arena-input min-w-0 flex-1"/><button type="submit" aria-label={friend?'Send private message':'Send message'} disabled={sending||!body.trim()||safety.isBlocked(friend?.userId)} className={`${button} grid w-12 shrink-0 place-items-center px-0`}>{sending?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}</button></div><p className="mt-2 text-right text-[10px] tabular-nums text-zinc-400">{body.length}/{friend?1000:300}</p></form>}
    {!friend&&!readOnly&&<div className="max-h-44 overflow-y-auto px-3"><CommunitySafetySettings safety={safety} names={names}/></div>}
  </section>;
}

function Friends({home,onViewLocker,onAction,onMessage,onChallenge}:{home:CommunityHome|null;onViewLocker:(p:CommunityPerson)=>void;onAction:(w:()=>Promise<unknown>,s?:string)=>Promise<void>;onMessage:(id:string)=>void;onChallenge:(id:string)=>void}){
  const safety=useCommunitySafety();const [query,setQuery]=useState('');const [results,setResults]=useState<CommunitySearchPerson[]>([]);const [searching,setSearching]=useState(false);const [searched,setSearched]=useState(false);const searchVersion=useRef(0);useEffect(()=>()=>{searchVersion.current+=1;},[]);const friends=(home?.friends||[]).filter(friend=>!safety.isBlocked(friend.userId));const {showToast}=useBallKnower();
  useEffect(()=>{if(!searched||query.trim().length<2)return;const version=++searchVersion.current;
    void searchCommunityUsers(query).then(next=>{if(version===searchVersion.current)setResults(next);}).catch(()=>{});
  },[home]);
  const search=async()=>{if(query.trim().length<2||searching)return;const version=++searchVersion.current;setSearching(true);setSearched(false);try{const next=await searchCommunityUsers(query);if(version===searchVersion.current){setResults(next);setSearched(true);}}catch(reason){if(version===searchVersion.current)showToast(reason instanceof Error?reason.message:'People search could not load.');}finally{if(version===searchVersion.current)setSearching(false);}};
  return <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"><section className={`${card} p-4`}><h2 className="text-lg font-black uppercase">Find Ball Knowers</h2><form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void search();}}><input aria-label="Search people" value={query} onChange={e=>{searchVersion.current+=1;setQuery(e.target.value);setResults([]);setSearched(false);setSearching(false);}} placeholder="Search display name" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm"/><button aria-label="Search" disabled={searching||query.trim().length<2} className={`${button} w-12 px-0`}>{searching?<Loader2 className="mx-auto h-4 w-4 animate-spin"/>:<Search className="mx-auto h-4 w-4"/>}</button></form><div className="mt-3 space-y-2">{!searched&&!results.length&&<p className="py-4 text-sm text-zinc-400">Enter at least 2 characters to find a friend.</p>}{searched&&!results.length&&<EmptyState icon={Search} title="No Ball Knowers found">Try another display name.</EmptyState>}{results.filter(person=>!safety.isBlocked(person.userId)).map(result=>{const relationship=friends.find(friend=>friend.userId===result.userId);const person={...result,isFriend:relationship?.status==='accepted'||result.isFriend,requestPending:relationship?.status==='pending'||result.requestPending};return <div key={person.userId} className="flex items-center gap-2 rounded-xl border border-white/10 p-3"><button type="button" onClick={()=>onViewLocker(person)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-xs">{person.displayName}</strong><span className="text-[9px] text-zinc-600">BK {person.bkRating} · H2H {person.h2hRating}</span></button><button type="button" disabled={person.isFriend||person.requestPending} onClick={()=>void onAction(()=>sendFriendRequest(person.userId),'Friend request sent')} className={button}>{person.isFriend?'Friends':person.requestPending?'Pending':'Add'}</button></div>})}</div></section><section className={`${card} overflow-hidden`}><header className="p-4"><h2 className="text-lg font-black uppercase">Friends & requests</h2></header>{friends.map(friend=><div key={friend.friendshipId} className="border-t border-white/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={()=>onViewLocker(friend)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{friend.displayName}</strong><span className="text-[9px] font-bold uppercase text-zinc-600">BK {friend.bkRating} · H2H {record(friend)}</span></button>{friend.status==='pending'?<div className="flex gap-2">{friend.direction==='incoming'&&<button type="button" onClick={()=>void onAction(()=>respondFriendRequest(friend.friendshipId,true),'Friend added')} className={button}>Accept</button>}<button type="button" onClick={()=>void onAction(()=>respondFriendRequest(friend.friendshipId,false),'Request removed')} className="min-h-11 px-2 text-[9px] font-black uppercase text-red-300">{friend.direction==='incoming'?'Decline':'Cancel'}</button></div>:<div className="text-[9px] font-black uppercase text-emerald-300">Friends</div>}</div>{friend.status==='accepted'&&<div className="arena-friend-actions mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={()=>onMessage(friend.userId)} className={button}>Message</button><button type="button" onClick={()=>onChallenge(friend.userId)} className={button}>Challenge</button><button type="button" onClick={()=>void onAction(()=>removeFriend(friend.friendshipId),'Friend removed')} className="min-h-11 rounded-xl border border-red-400/20 text-[9px] font-black uppercase text-red-300">Remove</button></div>}</div>)}{friends.length===0&&<p className="p-6 text-center text-xs text-zinc-600">Search for a Ball Knower to build your friends list.</p>}</section></div>;
}

function Messages({friends,initialFriendId}:{friends:CommunityFriend[];initialFriendId:string}){
  const [selectedId,setSelectedId]=useState(initialFriendId);const safety=useCommunitySafety();
  const visibleFriends=friends.filter(friend=>!safety.isBlocked(friend.userId));
  const selected=visibleFriends.find(friend=>friend.userId===selectedId)||visibleFriends[0];
  useEffect(()=>{setSelectedId(initialFriendId);},[initialFriendId]);
  if(!visibleFriends.length)return <section className={`${card} p-5`}><EmptyState icon={LockKeyhole} title="Friends-only messages">Add and accept a friend before starting a private conversation.</EmptyState><CommunitySafetySettings safety={safety} names={Object.fromEntries(friends.map(friend=>[friend.userId,friend.displayName]))}/></section>;
  return <div className="grid min-w-0 gap-4 md:grid-cols-[240px_minmax(0,1fr)]"><aside className={`${card} h-fit min-w-0 overflow-hidden`}><h2 className="p-4 text-sm font-black uppercase">Conversations</h2><div className="arena-conversations">{visibleFriends.map(friend=><button type="button" key={friend.userId} onClick={()=>setSelectedId(friend.userId)} aria-pressed={selected?.userId===friend.userId} className={`flex min-h-16 min-w-0 shrink-0 items-center gap-3 border-t border-white/5 px-4 text-left ${selected?.userId===friend.userId?'bg-[#d9b43b]/10':''}`}><span className="arena-avatar">{friend.displayName.slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{friend.displayName}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-400"/></button>)}</div></aside>{selected&&<Conversation key={selected.userId} friend={selected} safety={safety}/>}</div>;
}

function H2HLobby({home,me,onAction,onOpenMatch,onSolo}:{home:CommunityHome|null;me:string;onAction:(w:()=>Promise<unknown>,s?:string)=>Promise<void>;onOpenMatch:(id:string)=>void;onSolo:()=>void}){
  const live=home?.matches.find(m=>m.status==='active');const waiting=home?.matches.find(m=>m.status==='waiting');const incoming=home?.matches.filter(m=>m.status==='pending'&&m.opponentId===me)||[];const outgoing=home?.matches.filter(m=>m.status==='pending'&&m.challengerId===me)||[];const recent=home?.matches.filter(m=>m.status==='completed').slice(0,8)||[];
  return <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2"><section className={`${card} p-5`}><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#d9b43b]/10"><Clock3 className="text-[#d9b43b]"/></div><div><h2 className="text-xl font-black uppercase">60-second showdown</h2><p className="text-[10px] uppercase text-zinc-600">Most correct answers wins</p></div></div><ul className="mt-5 space-y-2 text-xs leading-5 text-zinc-400"><li>• Both players receive the same verified questions.</li><li>• Answers are scored on the server; question keys stay private.</li><li>• Wins and losses update your H2H record and rating.</li></ul>{live?<button type="button" onClick={()=>onOpenMatch(live.id)} className={`${button} mt-5 w-full bg-[#d9b43b] text-black`}>Rejoin live match</button>:waiting?<button type="button" onClick={()=>onOpenMatch(waiting.id)} className={`${button} mt-5 w-full`}><Loader2 className="mr-2 inline h-4 w-4 animate-spin"/>Searching · view match</button>:<button type="button" onClick={()=>void onAction(async()=>{const id=await startH2H();onOpenMatch(id);})} className={`${button} mt-5 w-full bg-[#d9b43b] text-black`}>Quick match</button>}<button type="button" onClick={onSolo} className="mt-3 min-h-11 w-full text-xs font-bold text-zinc-500 underline">Practice in solo trivia</button></section><section className={`${card} overflow-hidden`}><header className="p-4"><h2 className="text-sm font-black uppercase">Challenges & results</h2></header>{outgoing.map(match=><div key={match.id} className="border-t border-white/5 p-4"><strong className="block text-sm">Challenge sent to {match.opponentName||'friend'}</strong><p className="mt-1 text-xs text-zinc-400">Waiting for your friend to accept.</p><button type="button" className={`${button} mt-3`} onClick={()=>void onAction(()=>cancelH2H(match.id),'Challenge cancelled')}>Cancel challenge</button></div>)}{incoming.map(match=><div key={match.id} className="border-t border-white/5 p-4"><strong className="text-sm">{match.challengerName} challenged you</strong><div className="mt-3 flex gap-2"><button type="button" onClick={()=>void onAction(async()=>{await respondH2H(match.id,true);onOpenMatch(match.id)},'Challenge accepted')} className={button}>Accept</button><button type="button" onClick={()=>void onAction(()=>respondH2H(match.id,false),'Challenge declined')} className="min-h-11 px-3 text-[9px] font-black uppercase text-red-300">Decline</button></div></div>)}{recent.map(match=><div key={match.id} className="flex items-center justify-between border-t border-white/5 p-4"><div><strong className="block text-xs">{match.challengerName} vs {match.opponentName}</strong><span className="text-[9px] uppercase text-zinc-600">Final · {match.challengerScore}-{match.opponentScore}</span></div><span className={`text-[10px] font-black uppercase ${match.winnerId===me?'text-emerald-300':!match.winnerId?'text-amber-200':'text-red-300'}`}>{match.winnerId===me?'Win':!match.winnerId?'Tie':'Loss'}</span></div>)}{incoming.length===0&&outgoing.length===0&&recent.length===0&&<p className="p-8 text-center text-xs text-zinc-600">Challenges and final scores will appear here.</p>}</section></div>;
}

function H2HGame({matchId,me,onClose}:{matchId:string;me:string;onClose:()=>void}){
  const {data:match,error,refresh:load}=useCommunityResource(()=>fetchH2HMatch(matchId));
  const [now,setNow]=useState(Date.now());const [busy,setBusy]=useState(false);const [feedback,setFeedback]=useState('');
  const [finishError,setFinishError]=useState('');const finishing=useRef(false);const answerLock=useRef(false);const answered=useRef(new Set<number>());
  const feedbackTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const dialog=useRef<HTMLDialogElement>(null);const {showToast}=useBallKnower();
  useEffect(()=>{dialog.current?.showModal();const timer=window.setInterval(()=>setNow(Date.now()),250);const unsubscribe=subscribeCommunity('matches',()=>void load(),3000);
    return()=>{window.clearInterval(timer);if(feedbackTimer.current)clearTimeout(feedbackTimer.current);unsubscribe();};},[load]);
  const left=matchSecondsLeft(match?.startedAt,match?.durationSeconds||60,now);
  const question=match?.status==='active'?match.questions.find(item=>!item.answered&&!answered.current.has(item.ordinal)):undefined;
  const finish=useCallback(async()=>{
    if(finishing.current)return;finishing.current=true;setFinishError('');
    try{await finishH2H(matchId);await load(true);}
    catch(reason){setFinishError(reason instanceof Error?reason.message:'Could not confirm the final score. Retry.');}
    finally{finishing.current=false;}
  },[matchId,load]);
  const finishAttempted=useRef(false);
  useEffect(()=>{if(match?.status==='active'&&left===0&&!finishAttempted.current){finishAttempted.current=true;void finish();}},[left,match?.status,finish]);
  const answer=async(index:number)=>{
    if(!match||match.status!=='active'||!question||answerLock.current||left<=0)return;
    answerLock.current=true;setBusy(true);
    try{const result=await submitH2HAnswer(match.id,question.ordinal,index);answered.current.add(question.ordinal);setFeedback(result.isCorrect?'Correct!':'Missed');await load(true);}
    catch(reason){showToast(reason instanceof Error?reason.message:'Answer could not score.');}
    finally{answerLock.current=false;setBusy(false);if(feedbackTimer.current)clearTimeout(feedbackTimer.current);feedbackTimer.current=setTimeout(()=>setFeedback(''),800);}
  };
  const myScore=match?(match.challengerId===me?match.challengerScore:match.opponentScore):0;const theirScore=match?(match.challengerId===me?match.opponentScore:match.challengerScore):0;const opponent=match?(match.challengerId===me?match.opponentName:match.challengerName):'';
  return <dialog ref={dialog} aria-label="H2H Trivia match" onCancel={event=>{event.preventDefault();onClose();}} className="arena-match bk-arena fixed inset-0 z-[100] flex h-[100dvh] max-h-none w-full max-w-none flex-col border-0 bg-[#06090d] p-0 text-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"><header className="flex min-h-16 items-center justify-between border-b border-white/10 px-4"><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-[#d9b43b]">H2H Trivia</p><strong className="block max-w-[55vw] truncate text-sm">You {myScore} · {theirScore} {opponent||'Opponent'}</strong></div><div className={`text-3xl font-black tabular-nums ${left<=10?'text-red-400':'text-white'}`}>{match?.status==='active'?left:match?.status==='completed'?'FT':'—'}</div><button type="button" onClick={onClose} aria-label="Close match" className="grid h-11 w-11 place-items-center rounded-full border border-white/10"><X/></button></header><main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center overflow-y-auto p-4">{error&&<div role="alert" className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{error}<button type="button" className={`${button} ml-3`} onClick={()=>void load()}>Retry match</button></div>}{finishError&&<div role="alert" className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-200">{finishError}<button type="button" className={`${button} ml-3`} onClick={()=>void finish()}>Confirm final score</button></div>}{!match&&!error?<Loader2 className="mx-auto animate-spin text-[#d9b43b]"/>:!match?null:match.status==='waiting'||match.status==='pending'?<div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-[#d9b43b]"/><h2 className="mt-5 text-2xl font-black uppercase">{match.status==='waiting'?'Finding an opponent':'Waiting for your friend'}</h2><p className="mt-3 text-sm text-zinc-400">You can leave this screen and rejoin from H2H.</p>{match.challengerId===me&&<button type="button" className={`${button} mt-5`} disabled={busy} onClick={()=>{setBusy(true);void cancelH2H(match.id).then(onClose).catch(reason=>{showToast(reason instanceof Error?reason.message:'Could not cancel.');setBusy(false);});}}>Cancel {match.status==='waiting'?'search':'challenge'}</button>}</div>:match.status==='completed'?<div className={`${card} p-7 text-center`}><Trophy className="mx-auto h-12 w-12 text-[#d9b43b]"/><h2 className="mt-4 text-4xl font-black uppercase">{match.winnerId===me?'You win':!match.winnerId?'Tie game':'Opponent wins'}</h2><p className="mt-3 text-lg font-black">Final · {myScore}-{theirScore}</p><p className="mt-2 text-xs text-zinc-500">Your H2H record and rating have been updated in the BK Locker.</p><button type="button" onClick={onClose} className={`${button} mt-6 w-full bg-[#d9b43b] text-black`}>Back to arena</button></div>:match.status==='cancelled'||match.status==='declined'?<EmptyState icon={Swords} title={match.status==='cancelled'?'Match cancelled':'Challenge declined'}>Return to the Arena to find your next opponent.<button type="button" onClick={onClose} className={`${button} mt-5 block w-full`}>Back to arena</button></EmptyState>:question&&left>0?<div><div className="mb-3 flex items-center justify-between text-[9px] font-black uppercase text-zinc-500"><span>{question.tier}</span><span>Question {question.ordinal+1} of {match.questions.length}</span></div><h2 className="text-2xl font-black leading-tight sm:text-4xl">{question.question}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{question.answers.map((choice,index)=><button type="button" key={`${question.ordinal}-${index}`} disabled={busy||left<=0} onClick={()=>void answer(index)} className="min-h-16 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left text-sm font-bold transition active:scale-[.99] disabled:opacity-40"><span className="mr-3 text-[#d9b43b]">{String.fromCharCode(65+index)}</span>{choice}</button>)}</div>{feedback&&<div role="status" className="mt-5 text-center text-xl font-black uppercase text-[#ecd67d]">{feedback}</div>}</div>:<div className="text-center"><h2 className="text-2xl font-black uppercase">{left===0?'Time expired':'All answers locked'}</h2><p className="mt-2 text-sm text-zinc-500">Waiting for the clock or your opponent.</p></div>}</main></dialog>;
}
