export type StaffRole="recruiter"|"negotiator"|"client_manager"|"brand_director";
export type AgencyStaff={id:string;role:StaffRole;name:string;salaryK:number;hiredAt:string};
export type AgencyResume={
  tier:"ROOKIE OFFICE"|"RISING AGENCY"|"LEAGUE POWER";
  clientCapacity:number;
  activeClients:number;
  signedClients:number;
  careerDeals:number;
  contractValueM:number;
  fulfilledPromises:number;
  brokenPromises:number;
  staffCount:number;
  record:string;
};

export const STAFF_OPTIONS:Record<StaffRole,{label:string;costK:number;description:string}>={
  recruiter:{label:"RECRUITING DIRECTOR",costK:60,description:"+2 client capacity and stronger recruiting reach"},
  negotiator:{label:"CONTRACT SPECIALIST",costK:75,description:"+6 negotiation skill"},
  client_manager:{label:"CLIENT MANAGER",costK:55,description:"+6 client-care skill"},
  brand_director:{label:"BRAND DIRECTOR",costK:70,description:"+6 brand power"},
};
const NAMES=["Jordan Price","Maya Brooks","Chris Warren","Taylor Reed","Marcus Grant","Nia Coleman","Andre Lewis","Sam Rivera"];
const hash=(value:string)=>Array.from(value).reduce((n,c,i)=>n+c.charCodeAt(0)*(i+7),0);

export const agencyClientCapacity=(staff:AgencyStaff[])=>3+staff.filter(s=>s.role==="recruiter").length*2;
export const canHireStaff=(cashK:number,staff:AgencyStaff[],role:StaffRole)=>cashK>=STAFF_OPTIONS[role].costK&&!staff.some(s=>s.role===role);
export function hireAgencyStaff(role:StaffRole,cashK:number,staff:AgencyStaff[],date:string){
  if(!canHireStaff(cashK,staff,role))return {cashK,staff,hired:undefined};
  const option=STAFF_OPTIONS[role];
  const hired:AgencyStaff={id:`${role}:${date}`,role,name:NAMES[hash(`${role}:${date}`)%NAMES.length],salaryK:option.costK,hiredAt:date};
  return {cashK:cashK-option.costK,staff:[...staff,hired],hired};
}
export const contractFeeK=(totalM:number)=>Math.round(totalM*30);
export function buildAgencyResume(args:{reputation:number;activeClients:number;signedClients:number;wins:number;losses:number;staff:AgencyStaff[];deals:Array<{totalM:number}>;fulfilledPromises:number;brokenPromises:number}):AgencyResume{
  const value=args.deals.reduce((sum,d)=>sum+d.totalM,0);
  return {
    tier:args.reputation>=75?"LEAGUE POWER":args.reputation>=45?"RISING AGENCY":"ROOKIE OFFICE",
    clientCapacity:agencyClientCapacity(args.staff),activeClients:args.activeClients,signedClients:args.signedClients,
    careerDeals:args.deals.length,contractValueM:Number(value.toFixed(1)),fulfilledPromises:args.fulfilledPromises,
    brokenPromises:args.brokenPromises,staffCount:args.staff.length,record:`${args.wins}-${args.losses}`,
  };
}
