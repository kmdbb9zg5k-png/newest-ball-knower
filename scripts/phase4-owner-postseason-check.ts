import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{advanceOwnerSeason,OWNER_TEAM_ABBRS,owner2026Calendar,ownerGameRevenue,ownerStageLabel,qualifiesForOwnerPlayoffs,type OwnerSeasonSnapshot}from'../ownerSeasonEngine';

const base:OwnerSeasonSnapshot={abbr:'PHI',season:2026,week:18,stage:'regular',wins:9,losses:7,cashM:350,ticketPrice:125,parkingPrice:35,fanTrust:70,stadium:75,gmCostM:9,coachCostM:12};
assert.equal(qualifiesForOwnerPlayoffs(9,8),true);
assert.equal(qualifiesForOwnerPlayoffs(7,10),false);
assert.equal(advanceOwnerSeason({...base,week:17},false).nextStage,'regular','Week 17 must not end the 18-week calendar');
assert.equal(advanceOwnerSeason(base,false).nextStage,'wild-card','a qualified owner season must continue after Week 18');
assert.equal(advanceOwnerSeason({...base,wins:6,losses:10},false).seasonEnded,true,'a non-playoff season must roll over');
assert.equal(advanceOwnerSeason({...base,stage:'wild-card',week:18},true).nextStage,'divisional');
assert.equal(advanceOwnerSeason({...base,stage:'divisional',week:19},true).nextStage,'conference');
assert.equal(advanceOwnerSeason({...base,stage:'conference',week:20},true).nextStage,'super-bowl');
const champion=advanceOwnerSeason({...base,stage:'super-bowl',week:21},true);
assert.equal(champion.seasonEnded,true);
assert.equal(champion.wonChampionship,true);
assert.equal(champion.expensesM,21,'annual executive salaries must hit the P&L once');
assert.ok(champion.revenueM>=85,'a championship must include the title revenue bump');
assert.ok(ownerGameRevenue(base,true,false)>0);
assert.equal(ownerGameRevenue(base,false,false),0);
assert.equal(ownerStageLabel('wild-card',18),'WILD CARD');
const weeklyRevenue=[1,3,5,7,9,11,13,15,17].reduce((total,week)=>total+ownerGameRevenue({...base,week},true,false),0);
assert.ok(weeklyRevenue>ownerGameRevenue(base,true,false),'a season receipt must be able to accumulate every home gate');
for(const abbr of OWNER_TEAM_ABBRS){const calendar=owner2026Calendar(abbr);assert.equal(calendar.length,18);assert.equal(calendar.filter(week=>week.isBye).length,1);assert.equal(calendar.filter(week=>!week.isBye).length,17);}
assert.equal(owner2026Calendar('WAS')[0].isHome,false,'Washington opens Week 1 away at Philadelphia');
assert.equal(owner2026Calendar('PHI')[0].isHome,true,'Philadelphia opens Week 1 at home against Washington');
const ownerMode=readFileSync(new URL('../OwnerBusinessMode.tsx',import.meta.url),'utf8');
assert.ok(!ownerMode.includes('cashM:state.cashM-p.costM'),'annual staff salary must not also be charged up front');
console.log('Phase 4 Owner postseason checks passed.');
