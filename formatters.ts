const MONEY_PRECISION = 100;

export function roundMillions(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round((value + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatMillions(value: number): string {
  return roundMillions(value).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
}
