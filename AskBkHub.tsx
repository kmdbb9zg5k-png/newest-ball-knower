import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AlertCircle,Camera,Check,Clipboard,ImagePlus,Loader2,LockKeyhole,Send,ShieldCheck,Sparkles,Trash2,X} from 'lucide-react';
import {useBallKnower} from './BallKnowerContext';
import {ensureOnlineSession,supabase} from './supabase';
import {compressAskBkImages,type AskBkAttachment,ASK_BK_MAX_IMAGES} from './askBkImages';
import {Conversation,ConversationContent} from './components/ai-elements/conversation';
import {Message,MessageContent,MessageResponse} from './components/ai-elements/message';

type AskBkSource={title:string;url:string};
type AskBkMessage={id:string;role:'user'|'assistant';text:string;attachments?:AskBkAttachment[];attachmentCount?:number;sources?:AskBkSource[]};

const suggestions=[
  'Who should I start this week?',
  'Break down these roster screenshots',
  'What NFL injuries matter today?',
  'Is this fantasy trade worth it?',
];

const messageId=(role:AskBkMessage['role'])=>`${role}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function CopyAnswer({text}:{text:string}){
  const [copied,setCopied]=useState(false);
  const copy=async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);window.setTimeout(()=>setCopied(false),1_500)}catch{}};
  return <button type="button" onClick={()=>void copy()} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-white" aria-label="Copy answer">{copied?<Check className="h-3.5 w-3.5 text-emerald-400"/>:<Clipboard className="h-3.5 w-3.5"/>}{copied?'Copied':'Copy'}</button>;
}

export function AskBkHub(){
  const {activeLeague,currentUser}=useBallKnower();
  const [messages,setMessages]=useState<AskBkMessage[]>([]);
  const [draft,setDraft]=useState('');
  const [attachments,setAttachments]=useState<AskBkAttachment[]>([]);
  const [isPreparingImages,setIsPreparingImages]=useState(false);
  const [isAnswering,setIsAnswering]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const fileInputRef=useRef<HTMLInputElement|null>(null);
  const requestRef=useRef<AbortController|null>(null);
  const imagePreparationRef=useRef(0);
  const mountedRef=useRef(true);

  useEffect(()=>{mountedRef.current=true;return()=>{mountedRef.current=false;imagePreparationRef.current++;requestRef.current?.abort()}},[]);

  const leagueContext=useMemo(()=>{
    if(!activeLeague)return null;
    const member=activeLeague.members.find(item=>item.userId===currentUser?.id)||activeLeague.members.find(item=>!item.isAi&&item.userName===currentUser?.name);
    return{
      leagueName:activeLeague.name,teamName:member?.userName||currentUser?.name||'',status:activeLeague.status,
      scoring:activeLeague.settings?.scoringFormat||'ppr',currentWeek:activeLeague.settings?.currentWeek||1,
      salaryCap:activeLeague.salaryCap,memberCount:activeLeague.members.length,
      roster:(member?.roster||[]).map(player=>({name:player.name,team:player.team,position:player.position,rating:player.overallRating??player.ovr})),
    };
  },[activeLeague,currentUser?.id,currentUser?.name]);

  const chooseFiles=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;
    const preparationId=++imagePreparationRef.current;
    setError(null);setIsPreparingImages(true);
    try{const compressed=await compressAskBkImages(files,attachments);if(mountedRef.current&&preparationId===imagePreparationRef.current)setAttachments(compressed)}
    catch(imageError:any){if(mountedRef.current&&preparationId===imagePreparationRef.current)setError(imageError?.message||'Those screenshots could not be prepared.')}
    finally{if(mountedRef.current&&preparationId===imagePreparationRef.current)setIsPreparingImages(false)}
  };

  const clearSession=()=>{imagePreparationRef.current++;requestRef.current?.abort();requestRef.current=null;setMessages([]);setDraft('');setAttachments([]);setError(null);setIsPreparingImages(false);setIsAnswering(false)};

  const ask=async()=>{
    if(isAnswering||isPreparingImages)return;
    const question=draft.trim()||(attachments.length?'Analyze every attached screenshot. Tell me what matters most and what I should do.':'');
    if(!question){setError('Type a sports question or attach a screenshot first.');return}
    const userMessage:AskBkMessage={id:messageId('user'),role:'user',text:question,attachments:[...attachments],attachmentCount:attachments.length};
    setMessages(previous=>[...previous,userMessage]);setError(null);setIsAnswering(true);
    const controller=new AbortController();requestRef.current=controller;
    try{
      await ensureOnlineSession();
      const {data:sessionData}=await supabase!.auth.getSession();
      const accessToken=sessionData.session?.access_token;
      if(!accessToken)throw new Error('Your Ball Knower session could not be opened. Try again.');
      const history=[...messages,userMessage].slice(-12).map(message=>({role:message.role,text:message.text}));
      const response=await fetch('/api/ask-bk',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},cache:'no-store',signal:controller.signal,body:JSON.stringify({messages:history,images:userMessage.attachments?.map(image=>({name:image.name,dataUrl:image.dataUrl}))||[],leagueContext})});
      const payload=await response.json().catch(()=>({})) as {answer?:string;error?:string;sources?:AskBkSource[]};
      if(!response.ok||!payload.answer)throw new Error(payload.error||'Ask BK could not answer that right now.');
      if(!mountedRef.current)return;
      setMessages(previous=>[...previous.map(message=>message.id===userMessage.id?{...message,attachments:undefined}:message),{id:messageId('assistant'),role:'assistant',text:payload.answer!,sources:payload.sources||[]}]);
      setDraft('');setAttachments([]);
    }catch(requestError:any){
      if(requestError?.name==='AbortError')return;
      if(mountedRef.current){setMessages(previous=>previous.filter(message=>message.id!==userMessage.id));setError(requestError?.message||'Ask BK could not answer that right now.')}
    }finally{if(mountedRef.current){setIsAnswering(false);requestRef.current=null}}
  };

  return <section className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-5xl flex-col px-3 pb-5 pt-4 sm:px-5 md:min-h-[calc(100dvh-8rem)] md:pt-6">
    <div className="bk-glass overflow-hidden border-[var(--bk-team-accent)]/20">
      <div className="relative overflow-hidden border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgb(var(--bk-team-accent-rgb)/.2),transparent_42%)]" aria-hidden="true"/>
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--bk-team-accent)]/35 bg-[var(--bk-team-accent)]/10 sm:h-11 sm:w-11"><Sparkles className="h-4.5 w-4.5 text-[var(--bk-team-accent)] sm:h-5 sm:w-5"/></div><div><div className="bk-overline text-[8px] sm:text-[9px]">Football-first sports intelligence</div><h2 className="font-display text-[1.7rem] font-black uppercase leading-none tracking-tight sm:text-3xl">Ask <span className="text-[var(--bk-team-accent)]">BK</span></h2></div></div><p className="mt-1.5 max-w-xl text-[10px] font-semibold leading-4 text-zinc-400 sm:mt-2 sm:text-xs sm:leading-5">Fantasy decisions, injuries, matchups, news and screenshot breakdowns.</p></div>
          {messages.length>0&&<button type="button" onClick={clearSession} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 text-[9px] font-black uppercase text-zinc-400"><Trash2 className="h-3.5 w-3.5"/><span className="hidden sm:inline">Clear chat</span></button>}
        </div>
        <div className="relative mt-2.5 flex items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-2 text-[9px] font-bold leading-4 text-emerald-100 sm:mt-4 sm:py-2.5 sm:text-[10px]"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"/><span><b>Session only.</b> Chats and screenshots aren’t saved. They clear when you leave Ask BK or tap Clear.</span></div>
      </div>

      <div className="flex min-h-[52dvh] flex-col bg-[#080b10]/90 sm:min-h-[56dvh]">
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl px-3 py-2 sm:px-5 sm:py-5">
            {messages.length===0&&<div className="flex flex-col items-center justify-center px-1 py-1 text-center sm:min-h-[30dvh] sm:px-2"><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.035] sm:h-14 sm:w-14 sm:rounded-2xl"><ShieldCheck className="h-5 w-5 text-[var(--bk-team-accent)] sm:h-6 sm:w-6"/></div><h3 className="mt-2.5 font-display text-xl font-black uppercase sm:mt-4 sm:text-2xl">What do you need to know?</h3><p className="mt-1 max-w-md text-[10px] leading-4 text-zinc-500 sm:text-xs sm:leading-5">Live search only runs for current information. Advice can use your active league and roster.</p><div className="mt-3 grid w-full grid-cols-2 gap-2 sm:mt-5">{suggestions.map(suggestion=><button key={suggestion} type="button" onClick={()=>setDraft(suggestion)} className="min-h-11 rounded-xl border border-white/10 bg-white/[.025] px-2 py-2 text-left text-[10px] font-bold leading-4 text-zinc-300 hover:border-[var(--bk-team-accent)]/30 hover:bg-[var(--bk-team-accent)]/[.06] sm:min-h-12 sm:px-3 sm:text-[11px]">{suggestion}</button>)}</div></div>}
            {messages.map(message=><Message key={message.id} from={message.role} className={message.role==='user'?'max-w-[92%]':'max-w-full'}>
              <MessageContent className={message.role==='user'?'ml-auto rounded-2xl rounded-br-md bg-[var(--bk-team-accent)] px-4 py-3 text-[var(--bk-on-accent)]':'w-full rounded-2xl border border-white/10 bg-[#10141b] px-4 py-4 text-zinc-100 shadow-xl'}>
                {message.attachments?.length?<div className={`grid gap-2 ${message.attachments.length>1?'grid-cols-2':'grid-cols-1'}`}>{message.attachments.map(image=><img key={image.id} src={image.dataUrl} alt={`Attached ${image.name}`} className="max-h-56 w-full rounded-lg border border-black/20 object-cover"/>)}</div>:null}
                {!message.attachments?.length&&message.attachmentCount?<div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider opacity-70"><Camera className="h-3.5 w-3.5"/>{message.attachmentCount} screenshot{message.attachmentCount===1?'':'s'} analyzed · image data cleared</div>:null}
                {message.role==='assistant'?<MessageResponse className="ask-bk-response text-sm leading-6">{message.text}</MessageResponse>:<p className="whitespace-pre-wrap text-sm font-bold leading-5">{message.text}</p>}
                {message.role==='assistant'&&<div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3"><div className="flex flex-wrap gap-1.5">{message.sources?.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener" className="max-w-[15rem] truncate rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1.5 text-[9px] font-black text-zinc-400 hover:text-white">{source.title}</a>)}</div><CopyAnswer text={message.text}/></div>}
              </MessageContent>
            </Message>)}
            {isAnswering&&<Message from="assistant" className="max-w-full"><MessageContent className="rounded-2xl border border-white/10 bg-[#10141b] px-4 py-3"><div role="status" className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-400"><Loader2 className="h-4 w-4 animate-spin text-[var(--bk-team-accent)]"/>Reading the field…</div></MessageContent></Message>}
          </ConversationContent>
        </Conversation>

        <div className="border-t border-white/10 bg-[#0b0e13] p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            {attachments.length>0&&<div className="mb-3 flex gap-2 overflow-x-auto pb-1">{attachments.map((image,index)=><div key={image.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black"><img src={image.dataUrl} alt={`Screenshot ${index+1}`} className="h-full w-full object-cover"/><button type="button" aria-label={`Remove screenshot ${index+1}`} onClick={()=>setAttachments(current=>current.filter(item=>item.id!==image.id))} className="absolute right-1 top-1 grid h-7 w-7 min-h-0 place-items-center rounded-full bg-black/80 text-white"><X className="h-3.5 w-3.5"/></button></div>)}</div>}
            {error&&<div role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-400/[.07] px-3 py-2.5 text-xs font-bold leading-5 text-red-100"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
            <div data-testid="ask-bk-composer" className="rounded-2xl border border-white/10 bg-[#07090d] p-2 focus-within:border-[var(--bk-team-accent)]/40">
              <textarea aria-label="Ask BK question" value={draft} onChange={event=>setDraft(event.target.value.slice(0,2_000))} onKeyDown={event=>{if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();void ask()}}} disabled={isAnswering} rows={1} placeholder="Ask about football, fantasy, or any sport…" className="max-h-36 min-h-12 w-full resize-none border-0 bg-transparent px-2 py-2 text-sm font-semibold text-white outline-none placeholder:text-zinc-600 disabled:opacity-60 sm:min-h-[4.5rem]"/>
              <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2"><div className="flex min-w-0 items-center gap-2"><input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={event=>void chooseFiles(event)} className="sr-only"/><button type="button" disabled={isPreparingImages||isAnswering||attachments.length>=ASK_BK_MAX_IMAGES} onClick={()=>fileInputRef.current?.click()} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase text-zinc-400 disabled:opacity-40">{isPreparingImages?<Loader2 className="h-4 w-4 animate-spin"/>:<ImagePlus className="h-4 w-4"/>}<span className="hidden min-[365px]:inline">Screenshots</span><span>{attachments.length}/{ASK_BK_MAX_IMAGES}</span></button><span className="hidden truncate text-[9px] font-semibold text-zinc-600 sm:inline">Compressed before sending</span></div><button type="button" disabled={isAnswering||isPreparingImages||(!draft.trim()&&!attachments.length)} onClick={()=>void ask()} className="bk-accent-button flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4"/>Ask BK</button></div>
            </div>
            <p className="mt-2 flex items-start gap-1.5 px-1 text-[9px] font-semibold leading-4 text-zinc-600"><Camera className="mt-0.5 h-3 w-3 shrink-0"/>Up to five screenshots per question. AI can be wrong—confirm injuries, lineups, and betting information before acting.</p>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
