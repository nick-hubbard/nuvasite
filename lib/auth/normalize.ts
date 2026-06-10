/**
 * The User Account email is the global account identity, so it is always
 * normalized to lowercase before storage or lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * User Profile names are trimmed but keep the user's chosen casing.
 * Whitespace-only values are treated as absent.
 */
export function normalizeProfileName(
  name: string | null | undefined,
): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}
