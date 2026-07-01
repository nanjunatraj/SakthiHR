/**
 * Maps a login Username to the Supabase Auth email for a given establishment.
 *
 * A real email (containing "@") passes through unchanged; a bare username such as
 * ADMIN becomes admin@<code>.local — matching the address provisioned for each
 * establishment's default ADMIN account.
 */
export function usernameToEmail(username: string, code: string): string {
  const u = username.trim();
  return u.includes('@') ? u : `${u.toLowerCase()}@${code.toLowerCase()}.local`;
}

/** Mask an email for display, e.g. natraj@gmail.com → n****j@gmail.com. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const shown = local.length <= 2 ? local[0] ?? '' : `${local[0]}${'*'.repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}
