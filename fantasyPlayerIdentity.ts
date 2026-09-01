export function resolveHistoricalProviderId(
  identityProviderIds: string[],
  fallbackProviderIds: string[],
): string {
  const current = [...new Set(identityProviderIds.filter(Boolean))];
  const historical = [...new Set(fallbackProviderIds.filter(Boolean))];
  if (historical.length !== 1 || current.length > 1) return '';
  if (current.length === 1 && current[0] !== historical[0]) return '';
  return historical[0];
}

const HISTORICAL_NAME_SUFFIXES = ['Jr.', 'Jr', 'Sr.', 'Sr', 'II', 'III', 'IV', 'V'];
const HISTORICAL_NAME_ALIASES: Record<string, string[]> = {
  'Kenny Gainwell': ['Kenneth Gainwell'],
  'Kenneth Gainwell': ['Kenny Gainwell'],
  'Marquise Brown': ['Hollywood Brown'],
  'Hollywood Brown': ['Marquise Brown'],
};
const suffixPattern = /\s+(?:Jr\.?|Sr\.?|II|III|IV|V)$/i;

export function historicalNameVariants(playerName: string): string[] {
  const exactName = playerName.trim();
  const bases = [exactName, ...(HISTORICAL_NAME_ALIASES[exactName] || [])]
    .map(name => name.replace(suffixPattern, '').trim())
    .filter(Boolean);
  const variants = new Set<string>();
  bases.forEach(base => {
    variants.add(base);
    HISTORICAL_NAME_SUFFIXES.forEach(suffix => variants.add(`${base} ${suffix}`));
  });
  variants.delete(exactName);
  return [...variants];
}
