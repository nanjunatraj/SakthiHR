import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { ALL_SECTIONS, type Section } from './roleAccess';

// The `roles` table is not yet in the generated types; use an untyped client
// (same pattern as lib/credentials.ts) until types are regenerated.
const cdb = supabase as unknown as SupabaseClient;

export interface RolePrivilege {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
}

/** A User Master role — built-in or custom — as stored in `public.roles`. */
export interface RoleDef {
  id: string;
  name: string;
  description: string | null;
  /** true: signs into the Admin app; false: Self-Service portal only. */
  isStaff: boolean;
  /** Full access to every menu section (Super Admin / Admin). */
  allAccess: boolean;
  /** Menu sections this role may reach (ignored when allAccess). */
  sections: Section[];
  /** Default module-privilege template used to pre-fill a new user's privileges. */
  defaultPrivileges: RolePrivilege[];
  color: string;
  isSystem: boolean;
  active: boolean;
  sortOrder: number;
}

/** Colour choices for a role badge (keys map to Tailwind classes below). */
export const ROLE_COLORS = [
  'red', 'orange', 'amber', 'green', 'emerald', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'rose', 'gray',
] as const;
export type RoleColor = (typeof ROLE_COLORS)[number];

const BADGE_CLASSES: Record<string, string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

/** Tailwind classes for a role badge in the given colour (falls back to gray). */
export function roleBadgeClasses(color: string | null | undefined): string {
  return BADGE_CLASSES[color ?? 'gray'] ?? BADGE_CLASSES.gray;
}

// Modules that a privilege template can grant. Kept in sync with UserMaster.
export const PRIVILEGE_MODULES = [
  'Dashboard', 'Employees', 'Payroll', 'Attendance', 'Leave',
  'Loans', 'Reports', 'Configuration', 'User Master', 'Settings',
] as const;

// Which menu Section a privilege module belongs to — used to derive a sensible
// default template for roles that don't define one explicitly.
const MODULE_SECTION: Record<string, Section> = {
  Dashboard: 'Dashboard',
  Employees: 'HRMS',
  Payroll: 'Payroll',
  Attendance: 'Attendance',
  Leave: 'Leave',
  Loans: 'Payroll',
  Reports: 'Reports',
  Configuration: 'Configuration',
  'User Master': 'Configuration',
  Settings: 'Settings',
};

const emptyPriv = (module: string): RolePrivilege => ({
  module, view: false, create: false, edit: false, delete: false, export: false, approve: false,
});

/**
 * The privilege template for a role. If the role stores an explicit template we
 * use it; otherwise we derive one from its sections (all_access → everything;
 * scoped roles → view/create/edit/export on modules within their sections).
 */
export function privilegeTemplate(role: Pick<RoleDef, 'allAccess' | 'sections' | 'defaultPrivileges'>): RolePrivilege[] {
  if (role.defaultPrivileges && role.defaultPrivileges.length > 0) {
    return PRIVILEGE_MODULES.map((m) => role.defaultPrivileges.find((p) => p.module === m) ?? emptyPriv(m));
  }
  return PRIVILEGE_MODULES.map((module) => {
    if (role.allAccess) return { module, view: true, create: true, edit: true, delete: true, export: true, approve: true };
    const inScope = role.sections.includes(MODULE_SECTION[module]);
    return { module, view: inScope, create: inScope, edit: inScope, delete: false, export: inScope, approve: false };
  });
}

function rowToRole(r: Record<string, any>): RoleDef {
  return {
    id: r.id,
    name: r.name ?? '',
    description: r.description ?? null,
    isStaff: Boolean(r.is_staff),
    allAccess: Boolean(r.all_access),
    sections: ((r.sections as string[]) ?? []).filter((s): s is Section => ALL_SECTIONS.includes(s as Section)),
    defaultPrivileges: Array.isArray(r.default_privileges) ? (r.default_privileges as RolePrivilege[]) : [],
    color: r.color ?? 'gray',
    isSystem: Boolean(r.is_system),
    active: r.active !== false,
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 100,
  };
}

export interface RoleInput {
  name: string;
  description: string | null;
  isStaff: boolean;
  allAccess: boolean;
  sections: Section[];
  defaultPrivileges: RolePrivilege[];
  color: string;
  active: boolean;
}

function inputToRow(input: RoleInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    is_staff: input.isStaff,
    all_access: input.allAccess,
    sections: input.allAccess ? [] : input.sections,
    default_privileges: input.defaultPrivileges,
    color: input.color,
    active: input.active,
    updated_at: new Date().toISOString(),
  };
}

/** All roles, ordered for display (sort_order, then name). */
export async function listRoles(): Promise<{ roles: RoleDef[]; error: string | null }> {
  const { data, error } = await cdb.from('roles').select('*').order('sort_order').order('name');
  if (error) return { roles: [], error: error.message };
  return { roles: ((data ?? []) as Record<string, any>[]).map(rowToRole), error: null };
}

export async function createRole(input: RoleInput): Promise<{ error: string | null }> {
  const { error } = await cdb.from('roles').insert({ ...inputToRow(input), is_system: false, sort_order: 100 });
  return { error: error?.message ?? null };
}

export async function updateRole(id: string, input: RoleInput): Promise<{ error: string | null }> {
  const { error } = await cdb.from('roles').update(inputToRow(input)).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteRole(id: string): Promise<{ error: string | null }> {
  const { error } = await cdb.from('roles').delete().eq('id', id);
  return { error: error?.message ?? null };
}
