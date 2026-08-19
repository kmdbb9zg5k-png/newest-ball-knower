import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TEAM_THEMES, TeamTheme, applyTeamCssVariables, teamLogoUrl } from './teamTheme';

export function FavoriteTeamExperience({ onDone }: { onDone?: (team: TeamTheme) => void }) {
  const [index, setIndex] = useState(() => {
    const saved = localStorage.getItem('ball-knower-favorite-team');
    const found = TEAM_THEMES.findIndex(t => t.name === saved);
    return found >= 0 ? found : 25;
  });
  const [confirmed, setConfirmed] = useState(false);
  const touchX = useRef<number | null>(null);
  const team = TEAM_THEMES[index];
  const preview = useMemo(() => ({ primary: team.primary, secondary: team.secondary }), [team]);

  useEffect(() => {
    applyTeamCssVariables(team);
  }, [team]);

  const move = (delta: number) => {
    setConfirmed(false);
    setIndex(i => (i + delta + TEAM_THEMES.length) % TEAM_THEMES.length);
    try { navigator.vibrate?.(8); } catch {}
  };

  const confirm = () => {
    localStorage.setItem('ball-knower-favorite-team', team.name);
    localStorage.setItem('ball-knower-team-setup-v2', 'complete');
    applyTeamCssVariables(team);
    setConfirmed(true);
    window.setTimeout(() => onDone?.(team), 350);
  };

  const visible = [-2, -1, 0, 1, 2].map(offset => ({
    offset,
    team: TEAM_THEMES[(index + offset + TEAM_THEMES.length) % TEAM_THEMES.length],
  }));

  const cardSpacing = typeof window === 'undefined' ? 140 : Math.min(160, Math.max(108, window.innerWidth * .30));

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#020405] text-white [-webkit-overflow-scrolling:touch]">
      <style>{`
        @keyframes bkPulse { 0%,100% { opacity:.24; transform:scale(.98) } 50% { opacity:.58; transform:scale(1.04) } }
        @keyframes bkSweep { from { transform:translateX(-35%) rotate(-7deg) } to { transform:translateX(35%) rotate(7deg) } }
        @keyframes bkLogoFloat { 0%,100% { transform:translate(-50%,-50%) scale(.98) } 50% { transform:translate(-50%,-51.5%) scale(1.025) } }
        .bk-wheel-glow { animation:bkPulse 3.2s ease-in-out infinite; }
        .bk-light-sweep { animation:bkSweep 7s ease-in-out infinite alternate; }
        .bk-team-logo-bg { animation:bkLogoFloat 6s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none bg-[#020405]" />
      <div
        className="fixed inset-0 pointer-events-none transition-[background] duration-500"
        style={{background:`radial-gradient(circle at 50% 42%, ${preview.primary}88 0%, ${preview.primary}35 25%, #071012 55%, #020405 82%)`}}
      />
      <div
        className="fixed left-1/2 top-[45%] h-[68vh] w-[68vh] max-h-[680px] max-w-[680px] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[.14] bk-team-logo-bg transition-opacity duration-500"
        style={{filter:`drop-shadow(0 0 55px ${preview.secondary}55)`}}
      >
        <img src={teamLogoUrl(team.abbr)} alt="" className="h-full w-full object-contain" aria-hidden="true" />
      </div>
      <div className="fixed inset-0 pointer-events-none opacity-[.09]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.2) 1px,transparent 1px)',backgroundSize:'56px 56px',maskImage:'linear-gradient(to bottom,black,transparent 72%)'}} />
      <div className="fixed -inset-32 pointer-events-none blur-3xl opacity-40 bk-light-sweep" style={{background:`linear-gradient(110deg,transparent 28%,${preview.secondary}55 47%,transparent 65%)`}} />
      <div className="fixed inset-x-0 bottom-0 h-[48vh] pointer-events-none bg-gradient-to-t from-black via-black/88 to-transparent" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[760px] flex-col px-4 sm:px-5 pt-[max(20px,env(safe-area-inset-top))] pb-[max(30px,calc(env(safe-area-inset-bottom)+24px))]">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.28em] text-zinc-400">
          <span className="text-[#D4AF37]">BALL KNOWER</span><span>FAVORITE TEAM</span>
        </div>

        <div className="mt-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.32em] text-zinc-400">STEP 1 • PERSONALIZE YOUR EXPERIENCE</p>
          <h1 className="mt-2 text-[clamp(2.2rem,10vw,4.2rem)] font-black uppercase leading-[.92] tracking-tight">CHOOSE <span className="text-[#D4AF37]">YOUR TEAM.</span></h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">Spin the wheel. Lock in your squad.</p>
        </div>

        <div
          className="relative mt-4 h-[400px] sm:h-[470px] select-none touch-pan-y [perspective:1200px]"
          onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 42) move(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="absolute left-1/2 top-0 z-40 -translate-x-1/2">
            <div className="h-0 w-0 border-l-[14px] border-r-[14px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#D4AF37] drop-shadow-[0_0_12px_rgba(212,175,55,.9)]" />
          </div>

          <div className="absolute left-1/2 top-[54%] h-[325px] w-[94%] max-w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-white/10 bg-black/25 shadow-[inset_0_0_70px_rgba(255,255,255,.04),0_30px_90px_rgba(0,0,0,.75)]" />
          <div className="absolute left-1/2 top-[54%] h-[280px] w-[72%] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-[48%] blur-3xl bk-wheel-glow" style={{background:`${preview.primary}65`}} />

          <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
            {visible.map(({offset, team: t}) => {
              const abs = Math.abs(offset);
              const active = offset === 0;
              const translateX = offset * cardSpacing;
              const scale = active ? 1 : abs === 1 ? .73 : .52;
              const rotateY = offset * -30;
              return (
                <button
                  key={t.abbr}
                  onClick={() => offset === 0 ? undefined : move(offset)}
                  className="absolute flex h-[292px] w-[214px] flex-col items-center justify-center rounded-[42px] border transition-all duration-500 ease-out"
                  style={{
                    transform:`translateX(${translateX}px) translateZ(${-abs*115}px) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex:20-abs,
                    opacity:active?1:abs===1?.72:.30,
                    borderColor:active?'rgba(212,175,55,.78)':'rgba(255,255,255,.10)',
                    background:active?`linear-gradient(180deg,${t.primary}E6 0%,rgba(5,8,10,.96) 82%)`:'linear-gradient(180deg,rgba(22,27,32,.92),rgba(4,6,8,.96))',
                    boxShadow:active?`0 0 0 1px ${t.secondary}66 inset, 0 24px 65px ${t.primary}66, 0 0 26px rgba(212,175,55,.28)`:'0 18px 45px rgba(0,0,0,.6)',
                  }}
                >
                  <div className="flex h-[164px] w-[164px] items-center justify-center">
                    <img src={teamLogoUrl(t.abbr)} alt={t.name} className="max-h-[148px] max-w-[148px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.7)]" />
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-[9px] font-black uppercase tracking-[.22em] ${active?'text-[#D4AF37]':'text-zinc-500'}`}>{t.abbr}</p>
                    <p className={`mt-1 px-3 font-black uppercase leading-tight ${active?'text-[20px] text-white':'text-[15px] text-zinc-400'}`}>{t.name}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={() => move(-1)} aria-label="Previous team" className="absolute bottom-3 left-2 z-50 grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/45 bg-black/70 text-2xl text-[#D4AF37] backdrop-blur active:scale-95">‹</button>
          <button onClick={() => move(1)} aria-label="Next team" className="absolute bottom-3 right-2 z-50 grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/45 bg-black/70 text-2xl text-[#D4AF37] backdrop-blur active:scale-95">›</button>
        </div>

        <div className="mt-0 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-zinc-500">YOUR FAVORITE TEAM</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">{team.name}</h2>
          <p className="mt-2 text-xs font-bold text-zinc-500">{index + 1} / {TEAM_THEMES.length}</p>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-black/55 p-4 backdrop-blur-2xl" style={{boxShadow:`0 18px 70px ${preview.primary}33`}}>
          <button onClick={confirm} className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[.15em] text-black active:scale-[.985]" style={{background:'linear-gradient(135deg,#D4AF37,#f6d968)',boxShadow:'0 10px 30px rgba(212,175,55,.22)'}}>{confirmed ? '✓ TEAM LOCKED IN' : `CONFIRM ${team.abbr}`}</button>
          <button onClick={() => move(1)} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[.04] py-3 text-[11px] font-black uppercase tracking-[.18em] text-zinc-300">KEEP LOOKING</button>
          <button onClick={() => { localStorage.setItem('ball-knower-team-setup-v2','skipped'); onDone?.(team); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">SKIP FOR NOW</button>
        </div>
      </div>
    </div>
  );
}
