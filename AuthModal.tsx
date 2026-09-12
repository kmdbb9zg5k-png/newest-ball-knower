import React,{useEffect,useId,useState}from'react';
import{useBallKnower}from'./BallKnowerContext';
import{X,Mail,ArrowRight,CheckCircle2,Loader2,LockKeyhole}from'lucide-react';
import{attachEmailToAnonymousUser,ensureOnlineSession,fetchAuthProviderAvailability,sendEmailMagicLink,type AuthProviderAvailability,type PermanentAuthProvider}from'./supabase';
import{prepareGuestAccountMerge,startOAuthSignIn}from'./accountIdentity';
import{NATIVE_AUTH_RESULT_EVENT,type NativeAuthResultDetail}from'./nativeAuth';
import{trackBallKnowerEvent}from'./analytics';
import type{LaunchPanel}from'./LaunchCenter';
import{isPlaceholderGmName,saveProfileDisplayName}from'./profileIdentity';
import'./authExperience.css';

interface AuthModalProps{
  isOpen:boolean;
  onClose:()=>void;
  onOpenLegal?:(panel:LaunchPanel)=>void;
  presentation?:'modal'|'launch';
}

const GoogleMark=()=> <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/><path fill="#FBBC05" d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .1-2 .4-2.8L1.9 6.3C.7 8.7 0 10.8 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/></svg>;
const AppleMark=()=> <svg aria-hidden="true" viewBox="0 0 170 170"><path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.7-7.94-12.04-14.59-6.3-9.58-11.35-20.67-15.15-33.26-3.8-12.59-5.7-24.32-5.7-35.18 0-14.16 3.65-25.96 10.95-35.4 7.3-9.45 16.59-14.28 27.87-14.5 4.35 0 9.53 1.25 15.54 3.75 6.01 2.5 9.94 3.79 11.78 3.86 1.41 0 5.48-1.37 12.21-4.11 6.73-2.74 12.6-3.88 17.62-3.41 13.29 1.08 23.36 6.34 30.21 15.78-11.52 6.96-17.18 16.32-16.98 28.09.21 9.13 3.69 16.85 10.43 23.16 6.74 6.31 14.89 9.89 24.45 10.76-2.17 6.74-4.89 13.37-8.15 19.88zM119.22 33.02c0-7.39 2.66-14.24 7.98-20.55 5.32-6.31 11.89-10.22 19.71-11.74.87 7.61-1.63 14.7-7.5 21.28-5.87 6.58-12.6 10.51-20.19 11.01z"/></svg>;

export const AuthModal:React.FC<AuthModalProps>=({isOpen,onClose,onOpenLegal,presentation='modal'})=>{
  const{currentUser,setCurrentUser,updateCurrentUserName,showToast}=useBallKnower();
  const titleId=useId();
  const[emailInput,setEmailInput]=useState('');
  const[nameInput,setNameInput]=useState('');
  const[showEmailForm,setShowEmailForm]=useState(false);
  const[isSubmitting,setIsSubmitting]=useState(false);
  const[statusMessage,setStatusMessage]=useState<string|null>(null);
  const[errorMessage,setErrorMessage]=useState<string|null>(null);
  const[providerAvailability,setProviderAvailability]=useState<AuthProviderAvailability|null>(null);

  useEffect(()=>{
    if(!isOpen)return;
    let active=true;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    setProviderAvailability(null);
    setNameInput(currentUser?.name&&!isPlaceholderGmName(currentUser.name)?currentUser.name:'');
    void fetchAuthProviderAvailability().then(value=>{if(active)setProviderAvailability(value)});
    const onNativeResult=(event:Event)=>{
      const detail=(event as CustomEvent<NativeAuthResultDetail>).detail;
      setIsSubmitting(false);
      if(detail?.status==='cancelled'){
        setErrorMessage(null);
        setStatusMessage('Sign-in cancelled. Your Ball Knower account was not changed.');
      }else{
        setStatusMessage(null);
        setErrorMessage('Sign-in could not be completed. Try again.');
      }
    };
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&presentation==='modal')onClose()};
    window.addEventListener(NATIVE_AUTH_RESULT_EVENT,onNativeResult);
    window.addEventListener('keydown',onKeyDown);
    return()=>{
      active=false;
      document.body.style.overflow=previousOverflow;
      window.removeEventListener(NATIVE_AUTH_RESULT_EVENT,onNativeResult);
      window.removeEventListener('keydown',onKeyDown);
    };
  },[currentUser?.name,isOpen,onClose,presentation]);

  if(!isOpen)return null;

  const resetMessages=()=>{setStatusMessage(null);setErrorMessage(null)};
  const providerState=(provider:PermanentAuthProvider)=>providerAvailability?.[provider];
  const providerLabel=(provider:PermanentAuthProvider)=>{
    if(providerAvailability===null)return'CHECKING AVAILABILITY';
    const state=providerState(provider);
    if(state===true)return'SECURE SIGN-IN';
    if(state===false)return'SETUP REQUIRED';
    return'TRY SIGN-IN';
  };
  const providerDisabled=(provider:PermanentAuthProvider)=>isSubmitting||providerAvailability===null||providerState(provider)===false;

  const handleEmailSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();if(!emailInput.trim()||isSubmitting)return;
    setIsSubmitting(true);resetMessages();
    const email=emailInput.trim().toLowerCase();const name=nameInput.trim()||email.split('@')[0]||'Ball Knower GM';
    try{
      const authUser=await ensureOnlineSession();
      if(authUser.is_anonymous){
        try{
          await saveProfileDisplayName(name);
          updateCurrentUserName(name);
          const upgraded=await attachEmailToAnonymousUser(email,name);
          setCurrentUser({id:upgraded.id,name:(upgraded.user_metadata?.full_name as string|undefined)||name,email:upgraded.email||email,isAnonymous:Boolean(upgraded.is_anonymous),avatarPath:currentUser?.avatarPath,avatarUrl:currentUser?.avatarUrl,createdAt:upgraded.created_at||currentUser?.createdAt||new Date().toISOString()});
          trackBallKnowerEvent('Signup Started',{method:'email',flow:'guest_upgrade'});
          setStatusMessage('Verification email sent. Your guest identity stays the same, so your leagues and roster ownership are preserved.');
          showToast('Verification email sent — your Ball Knower identity is preserved.');
        }catch(upgradeError:any){
          const raw=upgradeError?.message||'';if(!/already|registered|exists|taken|duplicate/i.test(raw))throw upgradeError;
          await prepareGuestAccountMerge();await sendEmailMagicLink(email,name);
          trackBallKnowerEvent('Magic Link Requested',{method:'email',flow:'existing_account'});
          setStatusMessage('That email already has a Ball Knower account. Open the magic link and your guest XP, streaks and leagues will merge into it automatically.');
          showToast('Existing account found — magic sign-in link sent.');
        }
      }else{
        await sendEmailMagicLink(email,name);
        trackBallKnowerEvent('Magic Link Requested',{method:'email',flow:'signed_in_account'});
        setStatusMessage('Magic sign-in link sent. Open the email on this device to finish signing in.');
        showToast('Magic sign-in link sent.');
      }
    }catch(err:any){
      trackBallKnowerEvent('Auth Attempt Failed',{method:'email'});
      setErrorMessage(err?.message||'Could not start email authentication.');
    }finally{setIsSubmitting(false)}
  };

  const handleOAuth=async(provider:PermanentAuthProvider)=>{
    if(isSubmitting||providerAvailability===null||providerState(provider)===false)return;
    setIsSubmitting(true);resetMessages();
    try{
      await startOAuthSignIn(provider);
      trackBallKnowerEvent('Signup Started',{method:provider,flow:'permanent_identity'});
    }catch(err){
      console.warn(`${provider} sign-in could not start`,err);
      trackBallKnowerEvent('Auth Attempt Failed',{method:provider});
      setErrorMessage(`${provider==='apple'?'Apple':'Google'} sign-in could not start. Try again.`);
      setIsSubmitting(false);
    }
  };

  return <div className={`bk-auth-stage bk-auth-stage--${presentation}`} data-auth-presentation={presentation}>
    <div className="bk-auth-sky" aria-hidden="true"><span/><span/><span/></div>
    <section className="bk-auth-console" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {presentation==='modal'&&<button id="close-auth-modal-btn" onClick={onClose} className="bk-auth-close" aria-label="Close sign in"><X/></button>}
      <header className="bk-auth-brand"><div className="bk-auth-crest"><span className="bk-auth-laurel bk-auth-laurel--left">❮</span><img src="/ball-knower-icon.svg" alt=""/><span className="bk-auth-laurel bk-auth-laurel--right">❯</span></div><h2 id={titleId}>BALL KNOWER</h2><p>One account. One league identity.</p></header>

      {!showEmailForm?<div className="bk-auth-options">
        <button id="auth-google-btn" type="button" disabled={providerDisabled('google')} aria-disabled={providerDisabled('google')} onClick={()=>void handleOAuth('google')} className="bk-auth-provider"><span className="bk-auth-edge-light bk-auth-edge-light--green"/><span className="bk-auth-provider-mark bk-auth-provider-mark--google"><GoogleMark/></span><span className="bk-auth-provider-copy"><strong>Continue with Google</strong><small>{providerLabel('google')}</small></span><span className="bk-auth-edge-light bk-auth-edge-light--cyan"/></button>
        <button id="auth-apple-btn" type="button" disabled={providerDisabled('apple')} aria-disabled={providerDisabled('apple')} onClick={()=>void handleOAuth('apple')} className="bk-auth-provider"><span className="bk-auth-edge-light"/><span className="bk-auth-provider-mark bk-auth-provider-mark--apple"><AppleMark/></span><span className="bk-auth-provider-copy"><strong>Continue with Apple</strong><small>{providerLabel('apple')}</small></span><span className="bk-auth-edge-light"/></button>

        {(providerAvailability?.google===false||providerAvailability?.apple===false)&&<div className="bk-auth-alert bk-auth-alert--warning">A provider marked Setup Required is disabled in Ball Knower authentication settings. Email sign-in remains available.</div>}
        {statusMessage&&<div className="bk-auth-alert bk-auth-alert--success"><CheckCircle2/><span>{statusMessage}</span></div>}
        {errorMessage&&<div className="bk-auth-alert bk-auth-alert--error">{errorMessage}</div>}

        <button id="auth-email-btn" type="button" onClick={()=>{resetMessages();setShowEmailForm(true)}} className="bk-auth-email"><Mail/><span>Continue with Email</span></button>
        <div className="bk-auth-guest-card"><div className="bk-auth-guest-title"><LockKeyhole/>Guest access stays active</div><p>Signing in is optional. Play, choose a GM name, add a photo, and join leagues as a guest. Add email whenever you want confirmation and cross-device account recovery.</p></div>
        <button type="button" onClick={onClose} className="bk-auth-guest-button">Keep Playing As Guest</button>
      </div>:<form onSubmit={handleEmailSubmit} className="bk-auth-email-form">
        <div className="bk-auth-form-heading"><Mail/><div><strong>Continue with Email</strong><span>No password required</span></div></div>
        <label><span>Your Name / GM Alias</span><input type="text" required minLength={2} maxLength={40} autoComplete="nickname" placeholder="e.g. Eli" value={nameInput} onChange={e=>setNameInput(e.target.value)} disabled={isSubmitting}/><small>This is the name other GMs will see in every league.</small></label>
        <label><span>Email Address</span><input type="email" required autoComplete="email" inputMode="email" placeholder="you@domain.com" value={emailInput} onChange={e=>setEmailInput(e.target.value)} disabled={isSubmitting}/></label>
        {statusMessage&&<div className="bk-auth-alert bk-auth-alert--success"><CheckCircle2/><span>{statusMessage}</span></div>}
        {errorMessage&&<div className="bk-auth-alert bk-auth-alert--error">{errorMessage}</div>}
        <button type="submit" disabled={isSubmitting} className="bk-auth-submit">{isSubmitting?<Loader2 className="bk-auth-spinner"/>:<ArrowRight/>}<span>{isSubmitting?'CONNECTING...':'EMAIL MY CONFIRMATION LINK'}</span></button>
        <button type="button" onClick={()=>{resetMessages();setShowEmailForm(false)}} disabled={isSubmitting} className="bk-auth-back">Back to all sign in options</button>
      </form>}

      <p className="bk-auth-legal">By continuing, you agree to our <button type="button" onClick={()=>onOpenLegal?.('terms')}>Terms</button> and acknowledge our <button type="button" onClick={()=>onOpenLegal?.('privacy')}>Privacy Policy</button>.</p>
    </section>
  </div>;
};
