import assert from 'node:assert/strict';
import {advanceAgentCalendar,type AgentCalendar} from '../agentSeasonCalendar';
let calendar:AgentCalendar={seasonYear:2026,seasonWeek:0,phase:'preseason',simulatedDate:'2026-09-03'};
for(let season=2026;season<2031;season++){
 const counts={regular:0,postseason:0,offseason:0};
 for(let turn=0;turn<40;turn++){
  const next=advanceAgentCalendar(calendar);
  assert(next.nextDate>calendar.simulatedDate,'career dates must always advance');
  calendar={seasonYear:next.nextYear,seasonWeek:next.nextWeek,phase:next.nextPhase,simulatedDate:next.nextDate};
  if(calendar.phase==='preseason')break;
  counts[calendar.phase]++;
 }
 assert.deepEqual(counts,{regular:18,postseason:5,offseason:4});
 assert.equal(calendar.seasonYear,season+1);
 assert.equal(calendar.simulatedDate,`${season+1}-09-03`,'condensed offseason must return to the next autumn');
}
console.log('PASS: five Agent seasons, 18 regular weeks and complete postseason/offseason cycles, monotonic calendar and correct next-year restart.');
