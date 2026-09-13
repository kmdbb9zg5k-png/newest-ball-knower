export const SIMULATED_ART_BUDGET_SCOPE='production-v4' as const;
export const SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD=35_000_000 as const;
export const SIMULATED_ART_MODELS={economy:'gemini-3.1-flash-lite-image',review:'gemini-3.1-flash-image'} as const;
export const SIMULATED_ART_BATCH_COST_MICRO_USD={economy:17_000,review:35_000} as const;
export type SimulatedArtQualityTier=keyof typeof SIMULATED_ART_MODELS;

export function simulatedArtBudgetLimitMicroUsd(configured:unknown=35):number {
  const requested=Number(configured),dollars=Number.isFinite(requested)?Math.max(0,Math.min(35,requested)):35;
  return Math.min(SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD,Math.floor(dollars*1_000_000));
}

export function canReserveSimulatedArt(spent:number,reserved:number,cost:number,limit=SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD):boolean {
  return [spent,reserved,cost,limit].every(Number.isFinite)&&spent>=0&&reserved>=0&&cost>0&&limit>=0&&spent+reserved+cost<=Math.min(limit,SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD);
}

