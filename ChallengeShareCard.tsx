import React, {useState} from 'react';
import {miniGame, miniStatLabel, type MiniGameId, type MiniStats} from './miniChallenges';

export default function ChallengeShareCard({game, stats}: {game: MiniGameId; stats: MiniStats}) {
  const [error, setError] = useState('');
  const download = () => {
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable on this browser.');
      ctx.fillStyle = '#07131c'; ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = '#173c46'; ctx.lineWidth = 2;
      for (let y = 0; y < 1350; y += 90) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1080,y); ctx.stroke(); }
      ctx.fillStyle = '#79efc4'; ctx.font = 'bold 45px sans-serif'; ctx.fillText('BALL KNOWER', 80, 160);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 54px sans-serif'; ctx.fillText(miniGame(game).name, 80, 390, 920);
      ctx.font = 'bold 110px sans-serif'; ctx.fillText(miniStatLabel(game, stats), 80, 600, 920);
      ctx.font = '32px sans-serif'; ctx.fillText('COMMUNITY CHALLENGE RESULT', 80, 720);
      ctx.fillStyle = '#a9bbc5'; ctx.font = '28px sans-serif';
      ctx.fillText('Casual competition · device-reported performance', 80, 1130, 920);
      ctx.fillText('Think you can beat it?', 80, 1200);
      canvas.toBlob(blob => {
        if (!blob) { setError('Could not create the image. Please try again.'); return; }
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `ball-knower-${game}-result.png`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }, 'image/png'); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not export result.'); }
  };
  return <><button type="button" onClick={download}>Download result card</button>{error&&<p role="alert">{error}</p>}</>;
}
