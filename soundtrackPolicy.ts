export const isRetiredSoundtrackTrack = (value: string) =>
  /from[-_ ]the[-_ ]a[-_ ]to[-_ ]south[-_ ]jersey/i.test(value);

export const keepActiveSoundtrackTrack = (track: { title?: string; url?: string; pathname?: string }) =>
  !isRetiredSoundtrackTrack([track.title, track.url, track.pathname].filter(Boolean).join(' '));
