import type { AppearancePlayer } from './appearance';

export type StaffPortraitProfile = {
  id:string;
  name:string;
  nationality:string;
  role:'owner'|'agent';
  age:number;
  heightInches:number;
  weightLbs:number;
  visualDirection:string;
};

export const OWNER_PORTRAITS:StaffPortraitProfile[]=[
  {
    id:'solo-staff-owner-amara-okafor',name:'Amara Okafor',nationality:'Nigerian',role:'owner',age:49,heightInches:68,weightLbs:158,
    visualDirection:'Nigerian woman with deep brown skin, an elegant oval face, natural coiled hair in a refined low updo, and calm executive presence',
  },
  {
    id:'solo-staff-owner-kenji-watanabe',name:'Kenji Watanabe',nationality:'Japanese',role:'owner',age:57,heightInches:70,weightLbs:172,
    visualDirection:'Japanese man with warm light skin, mature angular features, short salt-and-pepper hair, clean shave, and reserved boardroom confidence',
  },
  {
    id:'solo-staff-owner-valentina-rojas',name:'Valentina Rojas',nationality:'Colombian',role:'owner',age:43,heightInches:66,weightLbs:145,
    visualDirection:'Colombian woman with medium olive-brown skin, expressive brown eyes, shoulder-length dark waves, and poised modern leadership',
  },
  {
    id:'solo-staff-owner-declan-byrne',name:'Declan Byrne',nationality:'Irish',role:'owner',age:61,heightInches:73,weightLbs:205,
    visualDirection:'Irish man with fair freckled skin, strong mature features, close-cropped silver-red hair, a neat short beard, and seasoned authority',
  },
];

export const AGENT_PORTRAITS:StaffPortraitProfile[]=[
  {
    id:'solo-staff-agent-maya-patel',name:'Maya Patel',nationality:'Indian',role:'agent',age:32,heightInches:65,weightLbs:132,
    visualDirection:'Indian woman with warm medium-brown skin, defined cheekbones, long dark hair in a sleek professional ponytail, and alert negotiating confidence',
  },
  {
    id:'solo-staff-agent-thiago-almeida',name:'Thiago Almeida',nationality:'Brazilian',role:'agent',age:37,heightInches:72,weightLbs:184,
    visualDirection:'Brazilian man with tan brown skin, athletic features, short dark curls, close-trimmed facial hair, and charismatic professional energy',
  },
  {
    id:'solo-staff-agent-ethan-cole',name:'Ethan Cole',nationality:'American',role:'agent',age:39,heightInches:72,weightLbs:186,
    visualDirection:'White American man in his late thirties with fair skin, a lean angular face, neatly styled medium-brown hair, light stubble, and composed high-stakes negotiating confidence',
  },
  {
    id:'solo-staff-agent-kwame-mensah',name:'Kwame Mensah',nationality:'Ghanaian',role:'agent',age:45,heightInches:74,weightLbs:210,
    visualDirection:'Ghanaian man with very deep brown skin, a broad distinguished face, precise low fade, shaped beard, and warm commanding presence',
  },
];

export const STAFF_ART_PROFILES=[...OWNER_PORTRAITS,...AGENT_PORTRAITS] as const;
export const STAFF_ART_BY_ID:Record<string,StaffPortraitProfile>=Object.fromEntries(STAFF_ART_PROFILES.map(profile=>[profile.id,profile]));

export function staffPortraitProfile(id:unknown,role:'owner'|'agent'):StaffPortraitProfile {
  const candidates=role==='owner'?OWNER_PORTRAITS:AGENT_PORTRAITS;
  const selected=typeof id==='string'?STAFF_ART_BY_ID[id]:undefined;
  return selected?.role===role?selected:candidates[0];
}

export function staffPortraitPlayer(profile:StaffPortraitProfile,displayName=profile.name):AppearancePlayer {
  return {
    id:profile.id,
    name:displayName,
    team:'BK',
    teamName:'Ball Knower Football Operations',
    position:'QB',
    jerseyNumber:0,
    age:profile.age,
    heightInches:profile.heightInches,
    weightLbs:profile.weightLbs,
  };
}
