export function canMergeHistoricalProviderRows(
  identityProviderIds: string[],
  fallbackProviderIds: string[],
): boolean {
  const current = [...new Set(identityProviderIds.filter(Boolean))];
  const historical = [...new Set(fallbackProviderIds.filter(Boolean))];
  return current.length === 1 && historical.length === 1 && current[0] === historical[0];
}
