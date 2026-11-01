import assert from 'node:assert/strict';
import {nextSessionBoundary} from '../sessionBoundary';
for(const identity of ['guest','user-default-1']){
 const first={identity,anonymous:true,revision:0};
 const hydrated=nextSessionBoundary(first,{id:'anon-a',isAnonymous:true});
 assert.equal(hydrated.revision,0,'first guest-profile hydration must preserve open game selection');
 assert.equal(nextSessionBoundary(hydrated,{id:'anon-a',isAnonymous:true}),hydrated,'token/profile refresh must not restart Home');
 assert.equal(nextSessionBoundary(hydrated,{id:'anon-a',isAnonymous:false}).revision,1,'same-UUID account upgrade must reset privileged session state');
 assert.equal(nextSessionBoundary(hydrated,{id:'anon-b',isAnonymous:true}).revision,1,'different guests must not share private Home state');
 assert.equal(nextSessionBoundary(hydrated,{id:'member-a',isAnonymous:false}).revision,1,'sign-in identity change must clear previous Home state');
 const logout=nextSessionBoundary(hydrated,null);assert.equal(logout.revision,1);
 assert.equal(nextSessionBoundary(logout,{id:'anon-b',isAnonymous:true}).revision,1,'new guest can hydrate only after logout already reset state');
 assert.equal(nextSessionBoundary(first,{id:'member-a',isAnonymous:false}).revision,1,'permanent identities retain account isolation');
}
console.log('PASS: initial anonymous profile hydration preserves Home/Community, real account changes/logout reset it.');
