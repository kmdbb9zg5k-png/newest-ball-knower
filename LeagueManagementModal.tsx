import React, { useEffect, useState } from 'react';
import { Check, Copy, LogOut, Settings2, Share2, Trash2, X } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { isLeagueCommissioner } from './leaguePermissions';
import { leagueJoinCodeError, normalizeLeagueJoinCode } from './leagueJoinCode';
import { customizeLeagueAction, removeLeagueAction } from './leagueManagementActions';
import { ModalPortal } from './ModalPortal';
import './fantasyHqControls.css';

const PUBLIC_APP_ORIGIN='https://ballknowerofficial.com';

export function LeagueManagementModal({leagueId,onClose}:{leagueId:string;onClose:()=>void}){
  const {leagues,currentUser,isDemoMode,onlineInvitesReady,syncLg,showToast}=useBallKnower();
  const league=leagues.find(item=>item.id===leagueId);
  const commissioner=Boolean(league&&isLeagueCommissioner(league,currentUser?.id));
  const [codeInput,setCodeInput]=useState(league?.code||'');
  const [busy,setBusy]=useState<'code'|'remove'|null>(null);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const [confirmingRemoval,setConfirmingRemoval]=useState(false);
  const [confirmationName,setConfirmationName]=useState('');

  useEffect(()=>{setCodeInput(league?.code||'');},[league?.code]);
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[onClose]);

  if(!league)return null;
  const normalizedCode=normalizeLeagueJoinCode(codeInput);
  const validationError=commissioner?leagueJoinCodeError(normalizedCode):null;
  const inviteUrl=`${PUBLIC_APP_ORIGIN}?join=${encodeURIComponent(league.code)}`;

  const copyCode=async()=>{
    try{
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(league.code);
      setCopied(true);window.setTimeout(()=>setCopied(false),1800);
    }catch{setError('Copy failed. Press and hold the code to copy it.');}
  };
  const shareInvite=async()=>{
    setError('');
    try{
      if(navigator.share){await navigator.share({title:league.name,text:`Join my Ball Knower league with code ${league.code}`,url:inviteUrl});return;}
      if(!navigator.clipboard?.writeText)throw new Error('Sharing unavailable');
      await navigator.clipboard.writeText(inviteUrl);setCopied(true);window.setTimeout(()=>setCopied(false),1800);
    }catch(err:any){if(err?.name!=='AbortError')setError('Share failed. Press and hold the code to copy it.');}
  };
  const saveCode=async()=>{
    if(validationError)return setError(validationError);
    setBusy('code');setError('');
    const result=await customizeLeagueAction(league,currentUser?.id,isDemoMode,onlineInvitesReady,normalizedCode);
    if(!result.success)setError(result.message);
    else{syncLg(league.id,result.code);setCodeInput(result.code||normalizedCode);showToast(`Join code changed to ${result.code}`);}
    setBusy(null);
  };
  const removeLeague=async()=>{
    setBusy('remove');setError('');
    const result=await removeLeagueAction(league,currentUser?.id,isDemoMode,onlineInvitesReady);
    setBusy(null);
    if(result.success){syncLg(league.id);showToast(result.message);onClose();}else setError(result.message);
  };

  return <ModalPortal>
    <div className="bk-league-manage-scrim" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
      <section className="bk-league-manage" role="dialog" aria-modal="true" aria-labelledby="bk-league-manage-title">
        <header><div><small>League access</small><h2 id="bk-league-manage-title">{league.name}</h2></div><button type="button" onClick={onClose} aria-label="Close league management"><X aria-hidden="true"/></button></header>
        <div className="bk-league-manage-code">
          <div><span>Join code</span><strong>{league.code}</strong><small>{league.inviteEnabled===false?'Invites are currently paused.':'Share this code with your league.'}</small></div>
          <button type="button" onClick={()=>void copyCode()} aria-label={`Copy join code ${league.code}`}>{copied?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}{copied?'Copied':'Copy'}</button>
          <button type="button" onClick={()=>void shareInvite()}><Share2 aria-hidden="true"/>Share</button>
        </div>
        {commissioner?<section className="bk-league-manage-custom" aria-labelledby="custom-code-title">
          <div><Settings2 aria-hidden="true"/><span><strong id="custom-code-title">Customize join code</strong><small>Make it memorable. Spaces become hyphens.</small></span></div>
          <label>Custom code<input value={codeInput} onChange={event=>{setCodeInput(normalizeLeagueJoinCode(event.target.value));setError('');}} maxLength={20} autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-describedby="custom-code-help"/></label>
          <p id="custom-code-help">4–20 letters, numbers, or hyphens. Codes are case-insensitive.</p>
          <button type="button" onClick={()=>void saveCode()} disabled={busy!==null||Boolean(validationError)||normalizedCode===league.code}>{busy==='code'?'Saving…':'Save custom code'}</button>
        </section>:<p className="bk-league-manage-owner-note">Only Commissioner {league.commissionerName} can customize this league’s join code.</p>}
        {error?<p className="bk-league-manage-error" role="alert">{error}</p>:null}
        <section className="bk-league-manage-danger" aria-labelledby="remove-league-title">
          <div><strong id="remove-league-title">{commissioner?'Delete league':'Leave league'}</strong><p>{commissioner?'Permanently deletes the league, its rosters, draft, messages, and history for everyone.':'Removes your team and this league from your dashboard. The league stays available to everyone else.'}</p></div>
          {!confirmingRemoval?<button type="button" onClick={()=>{setConfirmationName('');setConfirmingRemoval(true);}}>{commissioner?<Trash2 aria-hidden="true"/>:<LogOut aria-hidden="true"/>}{commissioner?'Delete league':'Leave league'}</button>:<div className="bk-league-manage-confirm"><p>{commissioner?<>This deletes the league for all {league.members.length} members. Type <strong>{league.name}</strong> to confirm.</>:"Leave this league now?"}</p>{commissioner&&<input aria-label="Type league name to confirm deletion" value={confirmationName} onChange={event=>setConfirmationName(event.target.value)} placeholder={league.name} autoComplete="off"/>}<button type="button" onClick={()=>{setConfirmationName('');setConfirmingRemoval(false);}} disabled={busy!==null}>Cancel</button><button type="button" onClick={()=>void removeLeague()} disabled={busy!==null||(commissioner&&confirmationName.trim()!==league.name.trim())}>{busy==='remove'?'Removing…':commissioner?'Permanently delete':'Yes, leave'}</button></div>}
        </section>
      </section>
    </div>
  </ModalPortal>;
}
