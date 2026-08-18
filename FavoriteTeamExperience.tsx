import React, { useEffect, useMemo, useState } from 'react';

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
    return found >= 0 ? found : 8;
  });
  const [confirmed, setConfirmed] = useState(false);
  const team = TEAMS[index];
  const abbr = team[1];

  const preview = useMemo(() => ({ primary: team[2], secondary: team[3] }), [team]);

  useEffect(() => {
    document.documentElement.style.setProperty('--bk-team-primary', preview.primary);
    document.documentElement.style.setProperty('--bk-team-secondary', preview.secondary);
  }, [preview]);

  const move = (delta: number) => setIndex(i => (i + delta + TEAMS.length) % TEAMS.length);

  const confirm = () => {
    localStorage.setItem('ball-knower-favorite-team', team[0]);
    localStorage.setItem('ball-knower-team-setup-v2', 'complete');
    setConfirmed(true);
    window.setTimeout(() => onDone?.(team), 700);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#030506] text-white">
      <style>{`
        @keyframes bkLights { 0%,100% { transform: translateX(-8%) rotate(-8deg); opacity:.25 } 50% { transform: translateX(8%) rotate(8deg); opacity:.55 } }
        @keyframes bkGlow { 0%,100% { opacity:.25; transform:scale(1) } 50% { opacity:.55; transform:scale(1.08) } }
        @keyframes bkFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
        @keyframes bkSpin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .bk-light { animation:bkLights 7s ease-in-out infinite alternate; }
        .bk-glow { animation:bkGlow 4s ease-in-out infinite; }
        .bk-float { animation:bkFloat 5s ease-in-out infinite; }
        .bk-ring { animation:bkSpin 18s linear infinite; }
      `}</style>

      <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 45%, ${preview.primary}55 0%, #050708 42%, #010202 100%)`}} />
      <div className="absolute -inset-32 bk-light blur-3xl" style={{background:`linear-gradient(110deg, transparent 20%, ${preview.primary}70 42%, transparent 60%)`}} />
      <div className="absolute -inset-32 bk-light blur-3xl" style={{animationDelay:'-3s', background:`linear-gradient(70deg, transparent 30%, ${preview.secondary}45 48%, transparent 65%)`}} />
      <div className="absolute left-1/2 top-[34%] h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl bk-glow" style={{background:`${preview.primary}50`}} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent" />

      <div className="relative mx-auto flex h-full max-w-md flex-col px-5 pb-8 pt-8">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.28em] text-zinc-400">
          <span className="text-[#D4AF37]">BALL KNOWER</span><span>FAVORITE TEAM</span>
        </div>

        <div className="mt-7 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.35em] text-zinc-400">STEP 1 • PERSONALIZE YOUR EXPERIENCE</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-tight">Choose Your Team.</h1>
          <p className="mt-2 text-sm text-zinc-400">Swipe through the league. Your choice changes the atmosphere.</p>
        </div>

        <div className="relative mt-7 flex flex-1 flex-col items-center justify-center">
          <div className="absolute h-[310px] w-[310px] rounded-full border border-white/10" />
          <div className="absolute h-[280px] w-[280px] rounded-full border border-white/10 bk-ring" style={{borderTopColor:preview.primary,borderRightColor:preview.secondary}} />
          <div className="absolute h-[245px] w-[245px] rounded-full" style={{boxShadow:`0 0 90px ${preview.primary}55`}} />

          <button onClick={() => move(-1)} className="absolute left-0 z-10 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xl backdrop-blur-xl">‹</button>
          <button onClick={() => move(1)} className="absolute right-0 z-10 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xl backdrop-blur-xl">›</button>

          <div className="relative z-10 flex h-48 w-48 items-center justify-center rounded-full border border-white/15 bg-black/45 backdrop-blur-xl bk-float" style={{boxShadow:`inset 0 0 50px ${preview.primary}25, 0 0 60px ${preview.primary}35`}}>
            <img src={logoUrl(abbr)} alt={team[0]} className="h-36 w-36 object-contain drop-shadow-2xl" onError={e => { e.currentTarget.style.display='none'; }} />
            <span className="absolute text-5xl font-black text-white/10">{abbr}</span>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[.3em] text-zinc-500">SELECTED TEAM</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">{team[0]}</h2>
            <div className="mt-3 flex justify-center gap-1.5">{TEAMS.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all ${i===index?'w-5':'w-1.5'}`} style={{background:i===index?preview.primary:'#ffffff33'}} />)}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/45 p-4 backdrop-blur-2xl" style={{boxShadow:`0 15px 60px ${preview.primary}20`}}>
          <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
            <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">YOUR FAVORITE TEAM</p><p className="mt-1 text-lg font-black">{team[0]}</p></div>
            <span className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest" style={{background:`${preview.primary}35`,color:'#fff'}}>Previewing</span>
          </div>
          <button onClick={confirm} className="mt-3 w-full rounded-2xl py-4 text-xs font-black uppercase tracking-[.18em] text-black transition-transform active:scale-[.98]" style={{background:'linear-gradient(135deg,#D4AF37,#f4d56a)',boxShadow:`0 10px 35px ${preview.primary}35`}}>{confirmed ? '✓ TEAM LOCKED IN' : `CONFIRM ${abbr}`}</button>
          <button onClick={() => move(1)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300">Keep Looking</button>
          <button onClick={() => {localStorage.setItem('ball-knower-team-setup-v2','skipped'); onDone?.(team)}} className="mt-2 w-full py-1 text-[9px] font-black uppercase tracking-widest text-zinc-600">Skip for now</button>
        </div>
      </div>
    </div>
  );
}
