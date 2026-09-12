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
const AuthCrest=()=> <svg className="bk-auth-crest-art" aria-hidden="true" viewBox="0 0 180 190">
  <defs>
    <linearGradient id="bkCrestGold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff0ae"/><stop offset=".24" stopColor="#bf8a2f"/><stop offset=".52" stopColor="#f3d27a"/><stop offset=".78" stopColor="#76501e"/><stop offset="1" stopColor="#d5aa4f"/></linearGradient>
    <linearGradient id="bkCrestDark" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#33281e"/><stop offset=".52" stopColor="#0b0d12"/><stop offset="1" stopColor="#25190d"/></linearGradient>
    <linearGradient id="bkCrestInset" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe99b" stopOpacity=".88"/><stop offset=".42" stopColor="#6b4516" stopOpacity=".32"/><stop offset="1" stopColor="#f2c964" stopOpacity=".8"/></linearGradient>
    <pattern id="bkCrestGrain" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#fff2b0" fillOpacity=".2"/><circle cx="4" cy="3" r=".55" fill="#000" fillOpacity=".3"/></pattern>
    <filter id="bkCrestShadow" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity=".7"/></filter>
  </defs>
  <g filter="url(#bkCrestShadow)">
    <path className="bk-auth-crest-laurel" d="M38 160C13 130 11 88 27 51M30 141c-11-5-17-13-20-24m25 9c-11-7-16-16-17-27m22 10c-10-9-13-18-12-29m18 15c-8-10-9-19-6-29m102 94c25-30 27-72 11-109m-3 90c11-5 17-13 20-24m-25 9c11-7 16-16 17-27m-22 10c10-9 13-18 12-29m-18 15c8-10 9-19 6-29" fill="none" stroke="url(#bkCrestGold)" strokeWidth="5" strokeLinecap="round"/>
    <g fill="url(#bkCrestGold)" stroke="#4a2e10" strokeWidth=".7">
      <ellipse cx="20" cy="124" rx="4" ry="10" transform="rotate(-38 20 124)"/><ellipse cx="17" cy="104" rx="4" ry="10" transform="rotate(-26 17 104)"/><ellipse cx="20" cy="83" rx="4" ry="10" transform="rotate(-15 20 83)"/><ellipse cx="27" cy="63" rx="4" ry="10" transform="rotate(-5 27 63)"/>
      <ellipse cx="160" cy="124" rx="4" ry="10" transform="rotate(38 160 124)"/><ellipse cx="163" cy="104" rx="4" ry="10" transform="rotate(26 163 104)"/><ellipse cx="160" cy="83" rx="4" ry="10" transform="rotate(15 160 83)"/><ellipse cx="153" cy="63" rx="4" ry="10" transform="rotate(5 153 63)"/>
    </g>
    <path d="M90 8 143 29v64c0 38-20 66-53 86-33-20-53-48-53-86V29z" fill="#0a0a0c" stroke="url(#bkCrestGold)" strokeWidth="5"/>
    <path d="M90 17 134 35v56c0 31-15 55-44 74-29-19-44-43-44-74V35z" fill="url(#bkCrestDark)" stroke="#e0bd67" strokeWidth="2"/>
    <path d="M90 23 128 39v51c0 27-12 48-38 66-26-18-38-39-38-66V39z" fill="url(#bkCrestGrain)" stroke="url(#bkCrestInset)" strokeWidth="1.2"/>
    <path d="M90 20v142M48 49h84M48 92h84" fill="none" stroke="#c69a44" strokeOpacity=".55" strokeWidth="1.5"/>
    <path d="m90 8 6 8-6 7-6-7zM47 51l7 3-6 6-6-3zm86 0-7 3 6 6 6-3z" fill="#f4d67e" stroke="#493011" strokeWidth="1"/>
    <g transform="rotate(-28 91 88)">
      <ellipse cx="91" cy="88" rx="23.5" ry="39.5" fill="#2b1b0b" stroke="#5c3b15" strokeWidth="5"/>
      <ellipse cx="91" cy="88" rx="21" ry="37" fill="url(#bkCrestGold)" stroke="#fff0b7" strokeWidth="1.5"/>
      <path d="M73 80c10 8 26 8 36 0M73 96c10-8 26-8 36 0" fill="none" stroke="#4c3116" strokeWidth="2"/>
      <path d="M91 73v30m-7-23h14m-14 7h14m-14 7h14" stroke="#3b2814" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M80 58c7-4 15-5 22-2" fill="none" stroke="#fff4c9" strokeOpacity=".62" strokeWidth="2" strokeLinecap="round"/>
    </g>
    <path d="M90 179 79 166h22z" fill="url(#bkCrestGold)"/>
  </g>
</svg>;
const AuthArenaArt=()=> <svg className="bk-auth-arena-art" aria-hidden="true" viewBox="0 0 430 932" preserveAspectRatio="none">
  <defs>
    <linearGradient id="bkArenaFloor" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2d1645" stopOpacity=".08"/><stop offset=".25" stopColor="#20173b" stopOpacity=".42"/><stop offset="1" stopColor="#071421" stopOpacity=".9"/></linearGradient>
    <linearGradient id="bkArenaGoldLine" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f1d784" stopOpacity=".76"/><stop offset="1" stopColor="#8a6928" stopOpacity=".18"/></linearGradient>
    <radialGradient id="bkArenaHorizon"><stop stopColor="#853dc2" stopOpacity=".36"/><stop offset=".52" stopColor="#292060" stopOpacity=".15"/><stop offset="1" stopColor="#06111d" stopOpacity="0"/></radialGradient>
    <filter id="bkArenaGlow"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <ellipse cx="215" cy="488" rx="245" ry="130" fill="url(#bkArenaHorizon)"/>
  <path d="M0 932h430L282 464H148z" fill="url(#bkArenaFloor)"/>
  <g className="bk-auth-floor-lines" fill="none" stroke="url(#bkArenaGoldLine)">
    <path d="M148 465h134"/><path d="M139 494h152"/><path d="M127 530h176"/><path d="M112 577h206"/><path d="M91 638h248"/><path d="M64 714h302"/><path d="M28 810h374"/><path d="M0 929h430"/>
    <path d="M149 465-74 932M174 465 45 932M194 465 130 932M215 465v467M236 465l64 467M256 465l129 467M281 465l223 467"/>
  </g>
  <g className="bk-auth-arena-rings" fill="none"><path d="M54 506c53-60 269-60 322 0"/><path d="M20 535c80-98 310-98 390 0"/><path d="M-16 574c105-139 357-139 462 0"/></g>
  <path className="bk-auth-horizon-beam" d="M48 465h334"/>
  <path d="M64 469h302" stroke="#50e8ff" strokeOpacity=".22" strokeWidth="8" filter="url(#bkArenaGlow)"/>
  <g className="bk-auth-arena-markers" fill="#e9cd76"><circle cx="149" cy="465" r="2"/><circle cx="181" cy="465" r="2"/><circle cx="215" cy="465" r="2.5"/><circle cx="249" cy="465" r="2"/><circle cx="281" cy="465" r="2"/></g>
</svg>;

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
          const raw=upgradeError?.message||'';
          const existingAccount=/already|registered|exists|taken|duplicate/i.test(raw);
          const emailChangeDeliveryFailed=/error sending email change email|smtp|send.*email|email.*send/i.test(raw);
          if(!existingAccount&&!emailChangeDeliveryFailed)throw upgradeError;
          await prepareGuestAccountMerge();await sendEmailMagicLink(email,name);
          trackBallKnowerEvent('Magic Link Requested',{method:'email',flow:existingAccount?'existing_account':'guest_upgrade_fallback'});
          setStatusMessage(existingAccount
            ?'That email already has a Ball Knower account. Open the magic link and your guest XP, streaks and leagues will merge into it automatically.'
            :'Confirmation link sent. Open it on this device and your guest XP, streaks and leagues will transfer automatically.');
          showToast(existingAccount?'Existing account found — magic sign-in link sent.':'Confirmation link sent — your guest progress is protected.');
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
    <div className="bk-auth-sky" aria-hidden="true"><span/><span/><span/><AuthArenaArt/></div>
    <section className="bk-auth-console" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {presentation==='modal'&&<button id="close-auth-modal-btn" onClick={onClose} className="bk-auth-close" aria-label="Close sign in"><X/></button>}
      <header className="bk-auth-brand"><div className="bk-auth-crest"><AuthCrest/></div><h2 id={titleId}>BALL KNOWER</h2><p>One account. One league identity.</p></header>

      {!showEmailForm?<div className="bk-auth-options">
        <button id="auth-google-btn" type="button" aria-label="Continue with Google" disabled={providerDisabled('google')} aria-disabled={providerDisabled('google')} onClick={()=>void handleOAuth('google')} className="bk-auth-provider"><span className="bk-auth-edge-light bk-auth-edge-light--green"/><span className="bk-auth-provider-mark bk-auth-provider-mark--google"><GoogleMark/></span><span className="bk-auth-provider-copy"><strong>Google</strong><small>{providerLabel('google')}</small></span><span className="bk-auth-edge-light bk-auth-edge-light--cyan"/></button>
        <button id="auth-apple-btn" type="button" aria-label="Continue with Apple" disabled={providerDisabled('apple')} aria-disabled={providerDisabled('apple')} onClick={()=>void handleOAuth('apple')} className="bk-auth-provider"><span className="bk-auth-edge-light"/><span className="bk-auth-provider-mark bk-auth-provider-mark--apple"><AppleMark/></span><span className="bk-auth-provider-copy"><strong>Apple</strong><small>{providerLabel('apple')}</small></span><span className="bk-auth-edge-light"/></button>

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
