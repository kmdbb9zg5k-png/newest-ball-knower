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
