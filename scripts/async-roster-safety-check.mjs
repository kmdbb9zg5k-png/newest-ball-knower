import fs from 'node:fs';

const source=fs.readFileSync(new URL('../BallKnowerContext.tsx',import.meta.url),'utf8');
const required=[
  "useRef } from 'react'",
  'const activeLeagueIdRef = useRef(activeLeagueId)',
  'const currentUserIdRef = useRef(currentUser?.id)',
  'const leaguesRef = useRef(leagues)',
  'const rosterMutationVersionRef = useRef(0)',
  'const autoDraftRequestRef = useRef(0)',
  'const invalidatePendingAutoDraft = () =>',
  'const requestLeagueId = activeLeagueIdRef.current',
  'const requestUserId = currentUserIdRef.current',
  'const requestRosterVersion = rosterMutationVersionRef.current',
  'const requestId = ++autoDraftRequestRef.current',
  'requestId !== autoDraftRequestRef.current',
  'requestRosterVersion !== rosterMutationVersionRef.current',
  'activeLeagueIdRef.current !== requestLeagueId',
  'currentUserIdRef.current !== requestUserId',
  "latestMember?.status === 'ready'",
  'invalidatePendingAutoDraft();\n    if (isDemoMode)',
];

const missing=required.filter(fragment=>!source.includes(fragment));
if(missing.length){
  console.error('Async roster safety contract failed. Missing:');
  missing.forEach(fragment=>console.error(`- ${fragment}`));
  process.exit(1);
}

const autoStart=source.indexOf('const autoDraftTemplate =');
const submitStart=source.indexOf('const submitRoster =',autoStart);
const autoSection=source.slice(autoStart,submitStart);
const rosterWrite=autoSection.lastIndexOf('setCurrentRoster(roster)');
const staleGuard=autoSection.lastIndexOf('if (!stillCurrent) return;',rosterWrite);
if(autoStart<0||submitStart<0||rosterWrite<0||staleGuard<0||staleGuard>rosterWrite){
  console.error('Async roster safety contract failed: auto-draft must revalidate immediately before replacing the roster.');
  process.exit(1);
}

for(const mutation of ['setCurrentRoster(candidateRoster)','setCurrentRoster(prev => prev.filter','setCurrentRoster([])']){
  const position=source.indexOf(mutation);
  if(position<0)continue;
  const preceding=source.slice(Math.max(0,position-160),position);
  if(!preceding.includes('invalidatePendingAutoDraft()')){
    console.error(`Async roster safety contract failed: ${mutation} is not invalidating pending auto-draft work.`);
    process.exit(1);
  }
}

console.log('Async roster safety contract passed.');