const JOIN_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,19}$/;

export const normalizeLeagueJoinCode = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '-');

export const leagueJoinCodeError = (value: string): string | null => {
  const normalized = normalizeLeagueJoinCode(value);
  if (normalized.length < 4 || normalized.length > 20) {
    return 'Use 4–20 letters, numbers, or hyphens.';
  }
  if (!JOIN_CODE_PATTERN.test(normalized)) {
    return 'Join codes must start with a letter or number and use only letters, numbers, or hyphens.';
  }
  return null;
};
