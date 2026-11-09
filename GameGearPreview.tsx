import { useCallback, useEffect, useRef } from 'react';
import type { AthletePassport } from './athletePassport';
import type { GameGear } from './playerGameGear';

export default function GameGearPreview({ athlete, gear, rotation, blackout = false }: {
  athlete: AthletePassport | null;
  gear: GameGear;
  rotation: number;
  blackout?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({
      type: 'bk-game-gear-preview',
      gear,
      rotation,
      blackout,
      name: athlete?.name,
      number: athlete?.number,
      team: athlete?.team,
    }, location.origin);
  }, [athlete, gear, rotation, blackout]);

  useEffect(() => {
    const onReady = (event: MessageEvent) => {
      if (event.origin === location.origin && event.source === frame.current?.contentWindow
        && event.data?.type === 'bk-game-gear-ready') send();
    };
    window.addEventListener('message', onReady);
    send();
    return () => window.removeEventListener('message', onReady);
  }, [send]);

  return <iframe ref={frame} title="Game gear 3D preview" src="/game-gear-preview.html?v=2" onLoad={send}/>;
}
