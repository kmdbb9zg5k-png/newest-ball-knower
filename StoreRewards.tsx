import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { readAthletePassport } from './athletePassport';
import { readResults } from './combine/dash.js';
import { loadGauntletProgress } from './gauntletEngine';
import { claimWardrobeReward, readWardrobeRewards } from './playerWardrobe';
import { storeImage } from './storeCatalog';

export default function StoreRewards({ onOpenLocker, onOpenGauntlet }: {
  onOpenLocker: () => void;
  onOpenGauntlet: () => void;
}) {
  const { currentUser } = useBallKnower();
  const [claimed, setClaimed] = useState(readWardrobeRewards);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const combineReady = Boolean(readAthletePassport()?.marks.length || readResults().some(result => result.context === 'standalone'));
  const gauntletReady = Object.values(loadGauntletProgress(currentUser?.id).daily).some(day => day?.completed === true);
  const rewards = [
    {
      id: 'top-combine-reward', name: 'Combine Practice Top', ready: combineReady,
      goal: 'Finish a My Player Combine drill or post a time in the standalone 40-yard dash.',
      play: <a className="bk-store-button" href="/combine.html">Play Combine <ChevronRight size={16} aria-hidden="true"/></a>,
    },
    {
      id: 'wrist-gauntlet-reward', name: 'Gauntlet Wristbands', ready: gauntletReady,
      goal: 'Complete a Daily Gauntlet.',
      play: <button className="bk-store-button" type="button" onClick={onOpenGauntlet}>Play Gauntlet <ChevronRight size={16} aria-hidden="true"/></button>,
    },
  ];

  function claim(id: string, name: string) {
    try {
      setClaimed(claimWardrobeReward(id));
      setStatus(name + ' added to My Locker.');
      setError('');
    } catch {
      setError('Your reward could not be saved on this device. Try again.');
    }
  }

  return <div className="bk-store-rewards">
    <img src={storeImage('free-gear')} alt="" loading="lazy"/>
    <h2>Play for your next look</h2>
    <p>Finish a challenge and claim gear for My Locker on this device.</p>
    <div className="bk-store-reward-grid">
      {rewards.map(reward => <article key={reward.id}>
        <h3>{reward.name}</h3>
        <p>{reward.goal}</p>
        {claimed.has(reward.id)
          ? <span className="bk-store-kicker">In My Locker</span>
          : reward.ready
            ? <button className="bk-store-button bk-store-button-gold" type="button" onClick={() => claim(reward.id, reward.name)}>Claim {reward.name}</button>
            : reward.play}
      </article>)}
    </div>
    <button className="bk-store-button" type="button" onClick={onOpenLocker}>Open My Locker</button>
    {status && <p className="bk-store-reward-status" role="status">{status}</p>}
    {error && <p className="bk-store-reward-status" role="alert">{error}</p>}
  </div>;
}
