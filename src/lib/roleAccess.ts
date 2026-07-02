// Role-based access control for the admin app.
//
// Roles are data-driven (see the `roles` table / src/lib/roles.ts). A signed-in
// staff member's role resolves to a set of menu sections (or full access), which
// decides both which menu sections are visible and which routes are reachable.
// The role itself decides the landing page (staff → Admin app, Employee → the
// Self-Service portal) via the `is_staff` flag returned at login.

// Top-level menu sections (match the Sidebar's top-level item labels).
export type Section =
  | 'Dashboard'
  | 'HRMS'
  | 'Attendance'
  | 'Leave'
  | 'Deductions'
  | 'Payroll'
  | 'Reports'
  | 'Configuration'
  | 'Settings';

export const ALL_SECTIONS: Section[] = [
  'Dashboard', 'HRMS', 'Attendance', 'Leave', 'Deductions', 'Payroll', 'Reports', 'Configuration', 'Settings',
];

/**
 * Whether a role may access a menu section.
 *  - `allAccess` → everything (Super Admin / Admin).
 *  - `sections == null` (role not yet resolved / unknown) → full access. Only
 *    Supabase-authenticated staff reach the admin app, and RLS still governs the
 *    data, so an unresolved role stays usable rather than locked out.
 *  - otherwise the section must be in the role's list.
 */
export function canAccessSection(
  sections: Section[] | null | undefined,
  allAccess: boolean,
  section: Section,
): boolean {
  if (allAccess) return true;
  if (sections == null) return true;
  return sections.includes(section);
}

// Map a route path to the section that governs it, so a role that can't see a
// section also can't reach it by typing the URL. Order matters: longest/most
// specific prefixes first.
const PATH_SECTIONS: { prefix: string; section: Section }[] = [
  { prefix: '/self-service', section: 'HRMS' },
  { prefix: '/employees', section: 'HRMS' },
  { prefix: '/exit', section: 'HRMS' },
  { prefix: '/polls', section: 'HRMS' },
  { prefix: '/attendance', section: 'Attendance' },
  { prefix: '/leave', section: 'Leave' },
  { prefix: '/deductions', section: 'Deductions' },
  { prefix: '/payroll', section: 'Payroll' },
  { prefix: '/salary-revision', section: 'Payroll' },
  { prefix: '/reports', section: 'Reports' },
  { prefix: '/configuration', section: 'Configuration' },
  { prefix: '/email-communications', section: 'Configuration' },
  { prefix: '/settings/software', section: 'Configuration' },
  { prefix: '/settings', section: 'Settings' },
];

/** The section governing a path, or null for always-allowed paths (/, /admin). */
export function sectionForRoute(pathname: string): Section | null {
  const hit = PATH_SECTIONS.find((p) => pathname === p.prefix || pathname.startsWith(p.prefix + '/'));
  return hit?.section ?? null;
}

// ── Master-editing permissions (by role name) ────────────────────────────────
// These are baseline role rules layered on top of section access:
//   • Only a Super Admin may change the Establishment identity (Name).
//   • Only Super Admin / Admin may CHANGE the configuration masters; every other
//     role may only view them. Asset Management is the exception (any staff role
//     may edit it). Enforced for real by RLS; the UI mirrors it.

/** True only for the Super Admin role. */
export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'Super Admin';
}

/** True for roles allowed to change configuration masters (Super Admin / Admin). */
export function canEditMasters(role: string | null | undefined): boolean {
  return role === 'Super Admin' || role === 'Admin';
}

/** Whether a role may open a given route in the admin app. */
export function canAccessRoute(
  sections: Section[] | null | undefined,
  allAccess: boolean,
  pathname: string,
): boolean {
  const section = sectionForRoute(pathname);
  if (!section) return true; // '/', '/admin', not-found, etc. are role-agnostic
  return canAccessSection(sections, allAccess, section);
}
