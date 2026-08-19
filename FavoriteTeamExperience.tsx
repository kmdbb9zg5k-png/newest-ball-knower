import React, { useEffect, useMemo, useRef, useState } from 'react';

const TEAMS = [
  ['Arizona Cardinals','ARI','#97233F','#FFB612'],['Atlanta Falcons','ATL','#A71930','#A5ACAF'],['Baltimore Ravens','BAL','#241773','#9E7C0C'],['Buffalo Bills','BUF','#00338D','#C60C30'],
  ['Carolina Panthers','CAR','#0085CA','#101820'],['Chicago Bears','CHI','#0B162A','#C83803'],['Cincinnati Bengals','CIN','#FB4F14','#000000'],['Cleveland Browns','CLE','#311D00','#FF3C00'],
  ['Dallas Cowboys','DAL','#003594','#869397'],['Denver Broncos','DEN','#FB4F14','#002244'],['Detroit Lions','DET','#0076B6','#B0B7BC'],['Green Bay Packers','GB','#203731','#FFB612'],
  ['Houston Texans','HOU','#03202F','#A71930'],['Indianapolis Colts','IND','#002C5F','#A2AAAD'],['Jacksonville Jaguars','JAX','#101820','#D7A22A'],['Kansas City Chiefs','KC','#E31837','#FFB81C'],
  ['Las Vegas Raiders','LV','#000000','#A5ACAF'],['Los Angeles Chargers','LAC','#0080C6','#FFC20E'],['Los Angeles Rams','LAR','#003594','#FFA300'],['Miami Dolphins','MIA','#008E97','#FC4C02'],
  ['Minnesota Vikings','MIN','#4F2683','#FFC62F'],['New England Patriots','NE','#002244','#C60C30'],['New Orleans Saints','NO','#D3BC8D','#101820'],['New York Giants','NYG','#0B2265','#A71930'],
  ['New York Jets','NYJ','#125740','#000000'],['Philadelphia Eagles','PHI','#004C54','#A5ACAF'],['Pittsburgh Steelers','PIT','#FFB612','#101820'],['San Francisco 49ers','SF','#AA0000','#B3995D'],
  ['Seattle Seahawks','SEA','#002244','#69BE28'],['Tampa Bay Buccaneers','TB','#D50A0A','#34302B'],['Tennessee Titans','TEN','#0C2340','#4B92DB'],['Washington Commanders','WAS','#5A1414','#FFB81C'],
] as const;

const logoUrl = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

export function FavoriteTeamExperience({ onDone }: { onDone?: (team: typeof TEAMS[number]) => void }) {
  const [index, setIndex] = useState(() => {
    const saved = localStorage.getItem('ball-knower-favorite-team');
    const found = TEAMS.findIndex(t => t[0] === saved);
    return found >= 0 ? found : 25;
  });
  const [confirmed, setConfirmed] = useState(false);
  const touchX = useRef<number | null>(null);
  const team = TEAMS[index];
  const preview = useMemo(() => ({ primary: team[2], secondary: team[3] }), [team]);

  useEffect(() => {
    document.documentElement.style.setProperty('--bk-team-primary', preview.primary);
    document.documentElement.style.setProperty('--bk-team-secondary', preview.secondary);
  }, [preview]);

  const move = (delta: number) => {
    setConfirmed(false);
    setIndex(i => (i + delta + TEAMS.length) % TEAMS.length);
    try { navigator.vibrate?.(8); } catch {}
  };

  const confirm = () => {
    localStorage.setItem('ball-knower-favorite-team', team[0]);
    localStorage.setItem('ball-knower-team-setup-v2', 'complete');
    setConfirmed(true);
    window.setTimeout(() => onDone?.(team), 450);
  };

  const visible = [-2,-1,0,1,2].map(offset => ({
    offset,
    team: TEAMS[(index + offset + TEAMS.length) % TEAMS.length],
  }));

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#020405] text-white [-webkit-overflow-scrolling:touch]">
      <style>{`
        @keyframes bkPulse { 0%,100% { opacity:.25; transform:scale(.98) } 50% { opacity:.6; transform:scale(1.04) } }
        @keyframes bkSweep { from { transform:translateX(-35%) rotate(-7deg) } to { transform:translateX(35%) rotate(7deg) } }
        .bk-wheel-glow { animation:bkPulse 3.2s ease-in-out infinite; }
        .bk-light-sweep { animation:bkSweep 7s ease-in-out infinite alternate; }
      `}</style>

      <div className="fixed inset-0 pointer-events-none" style={{background:`radial-gradient(circle at 50% 43%, ${preview.primary}55 0%, #071012 34%, #020405 70%)`}} />
      <div className="fixed -inset-32 pointer-events-none blur-3xl opacity-40 bk-light-sweep" style={{background:`linear-gradient(110deg,transparent 28%,${preview.secondary}55 47%,transparent 65%)`}} />
      <div className="fixed inset-x-0 bottom-0 h-[45vh] pointer-events-none bg-gradient-to-t from-black via-black/85 to-transparent" />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[760px] flex-col px-5 pt-[max(24px,env(safe-area-inset-top))] pb-[max(30px,calc(env(safe-area-inset-bottom)+24px))]">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.28em] text-zinc-400">
          <span className="text-[#D4AF37]">BALL KNOWER</span><span>FAVORITE TEAM</span>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.32em] text-zinc-400">STEP 1 • PERSONALIZE YOUR EXPERIENCE</p>
          <h1 className="mt-2 text-[clamp(2.3rem,10vw,4.2rem)] font-black uppercase leading-[.92] tracking-tight">CHOOSE <span className="text-[#D4AF37]">YOUR TEAM.</span></h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">Spin the wheel. Lock in your squad.</p>
        </div>

        <div
          className="relative mt-5 h-[410px] sm:h-[470px] select-none touch-pan-y [perspective:1200px]"
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
              const translateX = offset * (window.innerWidth < 520 ? 118 : 160);
              const scale = active ? 1.0 : abs === 1 ? .73 : .52;
              const rotateY = offset * -30;
              return (
                <button
                  key={t[1]}
                  onClick={() => offset === 0 ? undefined : move(offset)}
                  className="absolute flex h-[300px] w-[220px] flex-col items-center justify-center rounded-[42px] border transition-all duration-500 ease-out"
                  style={{
                    transform:`translateX(${translateX}px) translateZ(${-abs*115}px) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex:20-abs,
                    opacity:active?1:abs===1?.72:.28,
                    borderColor:active?'rgba(212,175,55,.75)':'rgba(255,255,255,.10)',
                    background:active?`linear-gradient(180deg,${t[2]}CC 0%,rgba(5,8,10,.96) 82%)`:'linear-gradient(180deg,rgba(22,27,32,.92),rgba(4,6,8,.96))',
                    boxShadow:active?`0 0 0 1px ${t[3]}55 inset, 0 24px 65px ${t[2]}55, 0 0 26px rgba(212,175,55,.24)`:'0 18px 45px rgba(0,0,0,.6)',
                  }}
                >
                  <div className="flex h-[170px] w-[170px] items-center justify-center">
                    <img src={logoUrl(t[1])} alt={t[0]} className="max-h-[150px] max-w-[150px] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,.7)]" />
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-[9px] font-black uppercase tracking-[.22em] ${active?'text-[#D4AF37]':'text-zinc-500'}`}>{t[1]}</p>
                    <p className={`mt-1 px-3 font-black uppercase leading-tight ${active?'text-[20px] text-white':'text-[15px] text-zinc-400'}`}>{t[0]}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={() => move(-1)} aria-label="Previous team" className="absolute bottom-3 left-3 z-50 grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/45 bg-black/70 text-2xl text-[#D4AF37] backdrop-blur active:scale-95">‹</button>
          <button onClick={() => move(1)} aria-label="Next team" className="absolute bottom-3 right-3 z-50 grid h-12 w-12 place-items-center rounded-full border border-[#D4AF37]/45 bg-black/70 text-2xl text-[#D4AF37] backdrop-blur active:scale-95">›</button>
        </div>

        <div className="mt-1 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-zinc-500">YOUR FAVORITE TEAM</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">{team[0]}</h2>
          <p className="mt-2 text-xs font-bold text-zinc-500">{index + 1} / {TEAMS.length}</p>
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-black/55 p-4 backdrop-blur-2xl" style={{boxShadow:`0 18px 70px ${preview.primary}22`}}>
          <button onClick={confirm} className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-[.15em] text-black active:scale-[.985]" style={{background:'linear-gradient(135deg,#D4AF37,#f6d968)',boxShadow:'0 10px 30px rgba(212,175,55,.22)'}}>{confirmed ? '✓ TEAM LOCKED IN' : `CONFIRM ${team[1]}`}</button>
          <button onClick={() => move(1)} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[.04] py-3 text-[11px] font-black uppercase tracking-[.18em] text-zinc-300">KEEP LOOKING</button>
          <button onClick={() => { localStorage.setItem('ball-knower-team-setup-v2','skipped'); onDone?.(team); }} className="mt-3 w-full py-2 text-[10px] font-black uppercase tracking-[.16em] text-zinc-500">SKIP FOR NOW</button>
        </div>
      </div>
    </div>
  );
}
