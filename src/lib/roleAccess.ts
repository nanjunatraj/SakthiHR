// Role-based access control for the admin app.
//
// A User Master role (system_users.role) decides both the landing page after
// login and which menu sections / routes are reachable. Employees never reach
// the admin app (they are routed to the Self-Service portal); the roles here are
// the "staff" roles that operate the admin app.

export type StaffRole =
  | 'Super Admin'
  | 'Admin'
  | 'HR Manager'
  | 'Payroll Manager'
  | 'Department Manager'
  | 'Auditor'
  | 'Employee';

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

const ALL_SECTIONS: Section[] = [
  'Dashboard', 'HRMS', 'Attendance', 'Leave', 'Deductions', 'Payroll', 'Reports', 'Configuration', 'Settings',
];

// Which sections each role may access. Super Admin and Admin get everything;
// the rest are scoped to their function. Employee gets nothing here — the portal
// is their home.
const ACCESS: Record<StaffRole, Section[]> = {
  'Super Admin': ALL_SECTIONS,
  'Admin': ALL_SECTIONS,
  'HR Manager': ['Dashboard', 'HRMS', 'Attendance', 'Leave', 'Reports'],
  'Payroll Manager': ['Dashboard', 'Payroll', 'Deductions', 'Reports'],
  'Department Manager': ['Dashboard', 'HRMS', 'Attendance', 'Leave', 'Reports'],
  'Auditor': ['Dashboard', 'Reports'],
  'Employee': [],
};

/** Normalise an arbitrary role string into a known StaffRole (defaults to Employee). */
export function normalizeRole(role: string | null | undefined): StaffRole {
  const r = (role ?? '').trim();
  return (r in ACCESS ? r : 'Employee') as StaffRole;
}

/** Employees belong in the Self-Service portal, not the admin app. */
export function isEmployeeRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'Employee';
}

/**
 * The sections a role may see. A signed-in staff member whose role can't be
 * resolved (null/unknown) keeps full access — only Supabase-authenticated staff
 * reach the admin app (employees never hold a session), and RLS still governs the
 * data. Explicit down-scoping applies only to the recognised limited roles.
 */
export function allowedSections(role: string | null | undefined): Section[] {
  const r = (role ?? '').trim();
  if (!r) return ALL_SECTIONS;
  if (r in ACCESS) return ACCESS[r as StaffRole];
  return ALL_SECTIONS;
}

export function canAccessSection(role: string | null | undefined, section: Section): boolean {
  return allowedSections(role).includes(section);
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

/** Whether a role may open a given route in the admin app. */
export function canAccessRoute(role: string | null | undefined, pathname: string): boolean {
  const section = sectionForRoute(pathname);
  if (!section) return true; // '/', '/admin', not-found, etc. are role-agnostic
  return canAccessSection(role, section);
}
