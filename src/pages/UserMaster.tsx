import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCog, Plus, Search, Pencil, Trash2, X, Shield, CheckCircle2,
  Eye, EyeOff, LayoutGrid, List, Lock, Unlock, Key, Users,
  Mail, Phone, Building2, Calendar, AlertCircle, Copy, RefreshCw,
  ChevronDown, Filter, Download, MoreVertical, UserCheck, UserX,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import { useTable } from '../hooks/useTable';
import { supabase } from '../supabase/client';

type UserRole = 'Super Admin' | 'Admin' | 'HR Manager' | 'Payroll Manager' | 'Department Manager' | 'Employee' | 'Auditor';
type UserStatus = 'Active' | 'Inactive' | 'Suspended' | 'Pending';

interface ModulePrivilege {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  approve: boolean;
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  avatar: string;
  lastLogin: string;
  createdAt: string;
  twoFactorEnabled: boolean;
  privileges: ModulePrivilege[];
  employeeId?: string;
}

const MODULES = [
  'Dashboard', 'Employees', 'Payroll', 'Attendance', 'Leave',
  'Loans', 'Reports', 'Configuration', 'User Master', 'Settings'
];

const ROLES: UserRole[] = ['Super Admin', 'Admin', 'HR Manager', 'Payroll Manager', 'Department Manager', 'Employee', 'Auditor'];

const ROLE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  'Super Admin': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'Admin': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'HR Manager': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  'Payroll Manager': { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  'Department Manager': { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  'Employee': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  'Auditor': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

const STATUS_STYLES: Record<UserStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  Inactive: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  Suspended: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  Pending: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

function defaultPrivileges(role: UserRole): ModulePrivilege[] {
  return MODULES.map(module => {
    if (role === 'Super Admin' || role === 'Admin') return { module, view: true, create: true, edit: true, delete: true, export: true, approve: true };
    if (role === 'HR Manager') return { module, view: true, create: module !== 'Settings' && module !== 'User Master', edit: module !== 'Settings' && module !== 'User Master', delete: module === 'Employees' || module === 'Leave', export: true, approve: module === 'Leave' || module === 'Loans' };
    if (role === 'Payroll Manager') return { module, view: true, create: module === 'Payroll' || module === 'Loans', edit: module === 'Payroll' || module === 'Loans', delete: false, export: module === 'Payroll' || module === 'Reports', approve: module === 'Payroll' || module === 'Loans' };
    if (role === 'Department Manager') return { module, view: module !== 'Settings' && module !== 'User Master' && module !== 'Configuration', create: module === 'Leave', edit: false, delete: false, export: module === 'Reports', approve: module === 'Leave' || module === 'Attendance' };
    if (role === 'Auditor') return { module, view: true, create: false, edit: false, delete: false, export: true, approve: false };
    return { module, view: module === 'Dashboard' || module === 'Leave' || module === 'Attendance', create: module === 'Leave', edit: false, delete: false, export: false, approve: false };
  });
}

// ─── Supabase row mapping (system_users + embedded user_privileges) ─────────────
type DbPrivRow = { module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; can_export: boolean; can_approve: boolean };
type DbUserRow = Record<string, unknown> & { id: string; privileges?: DbPrivRow[] };

function initials(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function rowToUser(r: DbUserRow): SystemUser {
  const privRows = r.privileges ?? [];
  const privileges: ModulePrivilege[] = MODULES.map(module => {
    const p = privRows.find(x => x.module === module);
    return {
      module,
      view: Boolean(p?.can_view),
      create: Boolean(p?.can_create),
      edit: Boolean(p?.can_edit),
      delete: Boolean(p?.can_delete),
      export: Boolean(p?.can_export),
      approve: Boolean(p?.can_approve),
    };
  });
  return {
    id: r.id,
    name: (r.name as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    department: (r.department as string) ?? '',
    role: (r.role as UserRole) ?? 'Employee',
    status: (r.status as UserStatus) ?? 'Active',
    avatar: (r.avatar as string) || initials((r.name as string) ?? ''),
    lastLogin: r.last_login ? new Date(r.last_login as string).toLocaleString('en-IN') : 'Never',
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString().split('T')[0] : '',
    twoFactorEnabled: Boolean(r.two_factor_enabled),
    privileges,
    employeeId: (r.employee_id as string) ?? undefined,
  };
}

function userFormToRow(f: UserFormData): Record<string, unknown> {
  return {
    name: f.name.trim(),
    email: f.email.trim(),
    phone: f.phone.trim() || null,
    department: f.department.trim() || null,
    role: f.role,
    status: f.status,
    avatar: initials(f.name),
    two_factor_enabled: f.twoFactorEnabled,
    employee_id: f.employeeId.trim() || null,
    // Login ID for the Employee Self-Service portal = the employee code.
    login_id: f.employeeCode.trim() || null,
  };
}

// Privileges persisted to the `user_privileges` table (replace-all per user).
async function writePrivileges(systemUserId: string, privileges: ModulePrivilege[]): Promise<string | null> {
  const del = await supabase.from('user_privileges').delete().eq('system_user_id', systemUserId);
  if (del.error) return del.error.message;
  const rows = privileges.map(p => ({
    system_user_id: systemUserId,
    module: p.module,
    can_view: p.view,
    can_create: p.create,
    can_edit: p.edit,
    can_delete: p.delete,
    can_export: p.export,
    can_approve: p.approve,
  }));
  const ins = await supabase.from('user_privileges').insert(rows);
  return ins.error?.message ?? null;
}

// Roles that also get an admin-app login (a Supabase Auth account). Plain
// Employees authenticate only against the Self-Service portal.
const STAFF_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'Super Admin', 'Admin', 'HR Manager', 'Payroll Manager', 'Department Manager', 'Auditor',
]);

/**
 * Create (or refresh the password of) the Supabase Auth account for a staff user
 * and link it to their system_users row, so they can sign in to the admin app.
 * The privileged work happens in the `provision-user` Edge Function (service
 * role); the browser only sends the admin's own JWT. Returns an error string or
 * null on success.
 */
async function provisionAdminLogin(systemUserId: string, email: string, password: string, fullName: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('provision-user', {
    body: { action: 'provision_system_user', system_user_id: systemUserId, email, password, full_name: fullName },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      const b = ctx?.json ? await ctx.json() : null;
      if (b?.error) msg = b.error;
    } catch { /* keep generic message */ }
    return msg;
  }
  if (data?.error) return String(data.error);
  return null;
}

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps { label: string; required?: boolean; children: React.ReactNode; hint?: string; }
const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface ToggleProps { value: boolean; onChange: (v: boolean) => void; label: string; description?: string; }
const Toggle = ({ value, onChange, label, description }: ToggleProps) => (
  <label className="flex items-center gap-3 cursor-pointer">
    <div onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}>
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </div>
    <div>
      <span className="text-sm font-medium">{label}</span>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
    </div>
  </label>
);

// ── User Form ──────────────────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  password: string;
  twoFactorEnabled: boolean;
  employeeId: string;     // employees.id uuid (FK)
  employeeCode: string;   // employees.employee_id text — used as the ESS login_id
}

const emptyUserForm = (): UserFormData => ({
  name: '', email: '', phone: '', department: '', role: 'Employee',
  status: 'Active', password: '', twoFactorEnabled: false, employeeId: '', employeeCode: '',
});

// ── Privilege Matrix ───────────────────────────────────────────────────────────

interface PrivilegeMatrixProps {
  privileges: ModulePrivilege[];
  onChange: (updated: ModulePrivilege[]) => void;
}

const PRIV_KEYS: (keyof Omit<ModulePrivilege, 'module'>)[] = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

const PrivilegeMatrix = ({ privileges, onChange }: PrivilegeMatrixProps) => {
  const toggle = (moduleIdx: number, key: keyof Omit<ModulePrivilege, 'module'>) => {
    const updated = privileges.map((p, i) => i === moduleIdx ? { ...p, [key]: !p[key] } : p);
    onChange(updated);
  };

  const grantAll = () => onChange(privileges.map(p => ({ ...p, view: true, create: true, edit: true, delete: true, export: true, approve: true })));
  const viewOnly = () => onChange(privileges.map(p => ({ ...p, view: true, create: false, edit: false, delete: false, export: false, approve: false })));
  const revokeAll = () => onChange(privileges.map(p => ({ ...p, view: false, create: false, edit: false, delete: false, export: false, approve: false })));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={grantAll} className="px-3 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-200 transition-colors">Grant All</button>
        <button onClick={viewOnly} className="px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-200 transition-colors">View Only</button>
        <button onClick={revokeAll} className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors">Revoke All</button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Module</th>
              {PRIV_KEYS.map(k => <th key={k} className="px-3 py-2.5 font-semibold text-center capitalize">{k}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {privileges.map((priv, i) => (
              <tr key={priv.module} className="hover:bg-accent/20 transition-colors">
                <td className="px-3 py-2.5 font-medium">{priv.module}</td>
                {PRIV_KEYS.map(key => (
                  <td key={key} className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => toggle(i, key)}
                      className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-all ${priv[key] ? 'bg-primary text-primary-foreground' : 'bg-accent border border-border text-transparent hover:border-primary/40'}`}
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── User Card ──────────────────────────────────────────────────────────────────

interface UserCardProps {
  user: SystemUser;
  onEdit: (u: SystemUser) => void;
  onDelete: (id: string) => void;
  onPrivileges: (u: SystemUser) => void;
  onToggleStatus: (id: string) => void;
}

const UserCard = ({ user, onEdit, onDelete, onPrivileges, onToggleStatus }: UserCardProps) => {
  const roleStyle = ROLE_STYLES[user.role];
  const statusStyle = STATUS_STYLES[user.status];
  const activeModules = user.privileges.filter(p => p.view).length;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} whileHover={{ y: -3 }} className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group overflow-hidden">
      <div className={`h-1 w-full ${user.status === 'Active' ? 'bg-green-400' : user.status === 'Suspended' ? 'bg-red-400' : user.status === 'Pending' ? 'bg-amber-400' : 'bg-gray-300'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base">{user.avatar}</div>
            <div>
              <p className="font-bold text-sm">{user.name}</p>
              <p className="text-[10px] text-muted-foreground">{user.department}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-500' : user.status === 'Suspended' ? 'bg-red-500' : user.status === 'Pending' ? 'bg-amber-500' : 'bg-gray-400'}`} />
            {user.status}
          </span>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail size={11} className="shrink-0" /><span className="truncate">{user.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone size={11} className="shrink-0" /><span>{user.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar size={11} className="shrink-0" /><span>Last login: {user.lastLogin}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
            <Shield size={9} />{user.role}
          </span>
          {user.twoFactorEnabled && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              <Lock size={9} /> 2FA
            </span>
          )}
          <span className="text-[10px] text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">{activeModules} modules</span>
        </div>

        <div className="flex items-center gap-1 pt-3 border-t border-border">
          <button onClick={() => onEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-primary/10 text-primary transition-colors"><Pencil size={12} /> Edit</button>
          <button onClick={() => onPrivileges(user)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-violet-50 text-violet-600 transition-colors"><Key size={12} /> Privileges</button>
          <button onClick={() => onToggleStatus(user.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-accent text-muted-foreground transition-colors ml-auto">
            {user.status === 'Active' ? <><UserX size={12} /> Suspend</> : <><UserCheck size={12} /> Activate</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Employee linking (only employees without a user account are selectable) ─────

interface LinkableEmployee {
  id: string;          // employees.id (uuid) — stored in system_users.employee_id
  code: string;        // employees.employee_id (text)
  name: string;
  department: string;
  email: string;
}

async function loadEmployeesForLinking(): Promise<LinkableEmployee[]> {
  const { data } = await supabase
    .from('employees')
    .select('id, employee_id, first_name, middle_name, last_name, email, department:departments(name)')
    .order('first_name');
  return ((data ?? []) as Record<string, any>[]).map(e => ({
    id: e.id,
    code: e.employee_id ?? '',
    name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' '),
    department: e.department?.name ?? '',
    email: e.email ?? '',
  }));
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface UserMasterProps {
  embedded?: boolean;
  onBack?: () => void;
}

export default function UserMaster({ embedded = false, onBack }: UserMasterProps) {
  // Stored in and retrieved from Supabase `system_users` (+ `user_privileges`) only.
  const usersTable = useTable<DbUserRow>('system_users', {
    select: '*, privileges:user_privileges(*)',
    orderBy: { column: 'created_at', ascending: true },
  });
  const users = useMemo(() => usersTable.rows.map(rowToUser), [usersTable.rows]);
  const [allEmployees, setAllEmployees] = useState<LinkableEmployee[]>([]);
  useEffect(() => { let a = true; void loadEmployeesForLinking().then(r => { if (a) setAllEmployees(r); }); return () => { a = false; }; }, []);
  // Employee UUIDs already linked to a user account.
  const linkedEmployeeIds = useMemo(() => new Set(users.map(u => u.employeeId).filter(Boolean) as string[]), [users]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'All'>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userForm, setUserForm] = useState<UserFormData>(emptyUserForm());
  const [showPassword, setShowPassword] = useState(false);

  // Employees selectable for linking: those without a user account, plus (when editing) the one already linked to this user.
  const availableEmployees = useMemo(
    () => allEmployees.filter(e => !linkedEmployeeIds.has(e.id) || e.id === editingUser?.employeeId),
    [allEmployees, linkedEmployeeIds, editingUser]
  );

  const [privilegeModal, setPrivilegeModal] = useState(false);
  const [privilegeUser, setPrivilegeUser] = useState<SystemUser | null>(null);
  const [editPrivileges, setEditPrivileges] = useState<ModulePrivilege[]>([]);

  const filtered = useMemo(() =>
    users
      .filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.department.toLowerCase().includes(search.toLowerCase()))
      .filter(u => roleFilter === 'All' || u.role === roleFilter)
      .filter(u => statusFilter === 'All' || u.status === statusFilter),
    [users, search, roleFilter, statusFilter]
  );

  const openAdd = () => {
    setEditingUser(null);
    setUserForm(emptyUserForm());
    setUserModal(true);
  };

  const openEdit = (user: SystemUser) => {
    setEditingUser(user);
    const code = allEmployees.find(e => e.id === user.employeeId)?.code ?? '';
    setUserForm({ name: user.name, email: user.email, phone: user.phone, department: user.department, role: user.role, status: user.status, password: '', twoFactorEnabled: user.twoFactorEnabled, employeeId: user.employeeId ?? '', employeeCode: code });
    setUserModal(true);
  };

  const openPrivileges = (user: SystemUser) => {
    setPrivilegeUser(user);
    setEditPrivileges(user.privileges.map(p => ({ ...p })));
    setPrivilegeModal(true);
  };

  const saveUser = async () => {
    if (!userForm.name.trim()) { toast.error('Name is required.'); return; }
    if (!userForm.email.trim()) { toast.error('Email is required.'); return; }

    const emailExists = users.some(u => u.email === userForm.email && (editingUser ? u.id !== editingUser.id : true));
    if (emailExists) { toast.error('Email already exists.'); return; }

    const row = userFormToRow(userForm);
    const enteredPassword = userForm.password.trim();
    if (editingUser) {
      // Only touch the password when a new one is entered; flag a forced change so the user re-sets it.
      if (enteredPassword) { row.password = enteredPassword; row.must_change_password = true; }
      const { error } = await usersTable.update(editingUser.id, row);
      if (error) { toast.error(error); return; }
      // Re-seed privileges from the role template only when the role actually changed.
      if (userForm.role !== editingUser.role) {
        const privErr = await writePrivileges(editingUser.id, defaultPrivileges(userForm.role));
        if (privErr) { toast.error(privErr); return; }
      }
      // Staff roles get an admin-app login (Supabase Auth) using the same
      // password — provision/refresh it whenever a new password was entered.
      if (STAFF_ROLES.has(userForm.role) && enteredPassword) {
        const perr = await provisionAdminLogin(editingUser.id, userForm.email.trim(), enteredPassword, userForm.name.trim());
        if (perr) { toast.error(`User saved, but admin login could not be set up: ${perr}`, { autoClose: 6000 }); setUserModal(false); return; }
      }
      toast.success('User updated successfully.');
    } else {
      // New users get a portal password (entered, else default to the Employee ID) and must change it on first login.
      const effectivePassword = enteredPassword || userForm.employeeCode.trim();
      row.password = effectivePassword || null;
      row.must_change_password = true;
      const { data, error } = await usersTable.insert(row);
      if (error || !data) { toast.error(error ?? 'Failed to create user.'); return; }
      const privErr = await writePrivileges(data.id, defaultPrivileges(userForm.role));
      if (privErr) { toast.error(privErr); return; }
      // Staff roles also get a matching admin-app login.
      if (STAFF_ROLES.has(userForm.role) && effectivePassword) {
        const perr = await provisionAdminLogin(data.id, userForm.email.trim(), effectivePassword, userForm.name.trim());
        if (perr) { toast.error(`User created, but admin login could not be set up: ${perr}`, { autoClose: 6000 }); setUserModal(false); return; }
      }
      toast.success(
        userForm.employeeCode.trim()
          ? `User created. Self-Service login: ${userForm.employeeCode.trim()} (password: ${row.password})`
          : 'User created successfully.',
        { autoClose: 5000 },
      );
    }
    setUserModal(false);
  };

  const savePrivileges = async () => {
    if (!privilegeUser) return;
    const err = await writePrivileges(privilegeUser.id, editPrivileges);
    if (err) { toast.error(err); return; }
    await usersTable.refetch();
    toast.success(`Privileges updated for ${privilegeUser.name}.`);
    setPrivilegeModal(false);
  };

  const deleteUser = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (target?.role === 'Super Admin' && users.filter(u => u.role === 'Super Admin').length <= 1) {
      toast.error('Cannot delete the only Super Admin account.'); return;
    }
    const err = (await usersTable.remove(id)).error;
    if (err) { toast.error(err); return; }
    toast.info('User deleted.');
  };

  const toggleStatus = async (id: string) => {
    const u = users.find(x => x.id === id);
    if (!u) return;
    if (u.role === 'Super Admin' && u.status === 'Active' && users.filter(x => x.role === 'Super Admin' && x.status === 'Active').length <= 1) {
      toast.error('Cannot suspend the only active Super Admin.'); return;
    }
    const err = (await usersTable.update(id, { status: u.status === 'Active' ? 'Suspended' : 'Active' })).error;
    if (err) toast.error(err);
  };

  const applyRoleTemplate = (role: UserRole) => {
    setEditPrivileges(defaultPrivileges(role));
    toast.info(`Applied ${role} template.`);
  };

  const activeCount = users.filter(u => u.status === 'Active').length;
  const adminCount = users.filter(u => u.role === 'Super Admin' || u.role === 'Admin' || u.role === 'HR Manager').length;
  const twoFACount = users.filter(u => u.twoFactorEnabled).length;
  const pendingCount = users.filter(u => u.status === 'Pending' || u.status === 'Suspended').length;

  const roleCounts = ROLES.reduce((acc, r) => { acc[r] = users.filter(u => u.role === r).length; return acc; }, {} as Record<UserRole, number>);

  const pageContent = (
    <>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {embedded && onBack && (
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="p-2 bg-indigo-100 rounded-lg"><UserCog size={22} className="text-indigo-600" /></div>
            <div>
              <h1 className="text-xl font-bold">User Master</h1>
              <p className="text-xs text-muted-foreground">Manage system users, roles, and module-level access privileges.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}><LayoutGrid size={16} /></button>
              <button onClick={() => setViewMode('table')} className={`p-2 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}><List size={16} /></button>
            </div>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users.length, sub: `${activeCount} active`, color: 'bg-indigo-100', iconColor: 'text-indigo-600', icon: Users },
            { label: 'Admins', value: adminCount, sub: 'Super Admin / Admin / HR', color: 'bg-red-100', iconColor: 'text-red-600', icon: Shield },
            { label: '2FA Enabled', value: twoFACount, sub: `${Math.round((twoFACount / users.length) * 100)}% coverage`, color: 'bg-emerald-100', iconColor: 'text-emerald-600', icon: Lock },
            { label: 'Pending / Suspended', value: pendingCount, sub: 'Needs attention', color: 'bg-amber-100', iconColor: 'text-amber-600', icon: AlertCircle },
          ].map((card, i) => (
            <motion.div key={i} whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className={`p-2.5 ${card.color} rounded-xl`}><card.icon size={20} className={card.iconColor} /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                <p className="font-bold text-lg mt-0.5">{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Role Distribution */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={15} className="text-primary" />
            <span className="text-sm font-bold">Role Distribution</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(role => {
              const count = roleCounts[role];
              if (count === 0) return null;
              const style = ROLE_STYLES[role];
              return (
                <button
                  key={role}
                  onClick={() => setRoleFilter(roleFilter === role ? 'All' : role)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${roleFilter === role ? `${style.bg} ${style.text} ${style.border} ring-2 ring-offset-1 ring-current` : `${style.bg} ${style.text} ${style.border} hover:opacity-80`}`}
                >
                  {role} ({count})
                </button>
              );
            })}
            {roleFilter !== 'All' && (
              <button onClick={() => setRoleFilter('All')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2">
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input type="text" placeholder="Search by name, email, or department..." className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
            <option value="All">All Roles</option>
            {ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
          <select className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="All">All Status</option>
            {(['Active', 'Inactive', 'Suspended', 'Pending'] as UserStatus[]).map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {users.length} users</div>
        </div>

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(user => (
              <UserCard key={user.id} user={user} onEdit={openEdit} onDelete={deleteUser} onPrivileges={openPrivileges} onToggleStatus={toggleStatus} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
                <UserCog size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No users found</p>
                <button onClick={openAdd} className="mt-4 flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium mx-auto">
                  <Plus size={15} /> Add User
                </button>
              </div>
            )}
          </div>
        )}

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Last Login</th>
                    <th className="px-4 py-3 font-semibold">2FA</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((user, i) => {
                    const roleStyle = ROLE_STYLES[user.role];
                    const statusStyle = STATUS_STYLES[user.status];
                    return (
                      <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-accent/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{user.avatar}</div>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-[10px] text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                            <Shield size={9} />{user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{user.department}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{user.lastLogin}</td>
                        <td className="px-4 py-3">
                          {user.twoFactorEnabled ? (
                            <span className="text-emerald-600 flex items-center gap-1 text-xs font-medium"><Lock size={11} /> On</span>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1 text-xs"><Unlock size={11} /> Off</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Active' ? 'bg-green-500' : user.status === 'Suspended' ? 'bg-red-500' : user.status === 'Pending' ? 'bg-amber-500' : 'bg-gray-400'}`} />
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => openPrivileges(user)} className="p-1.5 rounded-lg hover:bg-violet-50 text-muted-foreground hover:text-violet-600 transition-colors"><Key size={13} /></button>
                            <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Role Privilege Overview */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
            <Shield size={16} className="text-primary" />
            <h3 className="font-bold text-sm">Role Privilege Overview</h3>
            <span className="ml-auto text-xs text-muted-foreground">Default access levels per role</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Module</th>
                  {ROLES.map(r => <th key={r} className="px-3 py-2.5 font-semibold text-center">{r.split(' ')[0]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MODULES.map(mod => (
                  <tr key={mod} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{mod}</td>
                    {ROLES.map(role => {
                      const priv = defaultPrivileges(role).find(p => p.module === mod);
                      const level = priv ? (priv.approve ? 'Full' : priv.edit ? 'Edit' : priv.view ? 'View' : 'None') : 'None';
                      return (
                        <td key={role} className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${level === 'Full' ? 'bg-green-100 text-green-700' : level === 'Edit' ? 'bg-blue-100 text-blue-700' : level === 'View' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                            {level}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Form Modal */}
      <AnimatePresence>
        {userModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">{editingUser ? `Edit User — ${editingUser.name}` : 'Add New User'}</h2>
                <button onClick={() => setUserModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Field label="Full Name" required>
                      <input type="text" className={inputCls} placeholder="Full name" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Email Address" required>
                    <input type="email" className={inputCls} placeholder="user@company.com" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
                  </Field>
                  <Field label="Phone Number">
                    <input type="tel" className={inputCls} placeholder="+91 98765 43210" value={userForm.phone} onChange={e => setUserForm(f => ({ ...f, phone: e.target.value }))} />
                  </Field>
                  <Field label="Department">
                    <input type="text" className={inputCls} placeholder="e.g. Engineering" value={userForm.department} onChange={e => setUserForm(f => ({ ...f, department: e.target.value }))} />
                  </Field>
                  <Field label="Link Employee" hint={editingUser ? 'Linked employee record (optional)' : 'Only employees without a user account are listed'}>
                    <select
                      className={selectCls}
                      value={userForm.employeeId}
                      onChange={e => {
                        const id = e.target.value;
                        const emp = availableEmployees.find(x => x.id === id);
                        setUserForm(f => ({
                          ...f,
                          employeeId: id,
                          employeeCode: emp?.code ?? '',
                          // Auto-fill identity from the employee where the field is still empty.
                          name: emp && !f.name.trim() ? emp.name : f.name,
                          email: emp && !f.email.trim() ? (emp.email || emp.code) : f.email,
                          department: emp && !f.department.trim() ? emp.department : f.department,
                        }));
                      }}
                    >
                      <option value="">{availableEmployees.length === 0 ? '— No unlinked employees —' : '— Select Employee —'}</option>
                      {availableEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.code ? `${emp.code} — ${emp.name}` : emp.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Role" required>
                    <select className={selectCls} value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={selectCls} value={userForm.status} onChange={e => setUserForm(f => ({ ...f, status: e.target.value as UserStatus }))}>
                      {(['Active', 'Inactive', 'Pending', 'Suspended'] as UserStatus[]).map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <Field label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'} required={!editingUser}>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder={editingUser ? 'Leave blank to keep current' : 'Set password'} value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
                        <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Toggle value={userForm.twoFactorEnabled} onChange={v => setUserForm(f => ({ ...f, twoFactorEnabled: v }))} label="Enable Two-Factor Authentication" description="Require 2FA for this user's login" />
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setUserModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={saveUser} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privileges Modal */}
      <AnimatePresence>
        {privilegeModal && privilegeUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <div className="flex items-center gap-3">
                  <Key size={18} className="text-violet-600" />
                  <div>
                    <h2 className="text-lg font-bold">Module Privileges — {privilegeUser.name}</h2>
                    <p className="text-xs text-muted-foreground">{privilegeUser.role} · {privilegeUser.department}</p>
                  </div>
                </div>
                <button onClick={() => setPrivilegeModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide mr-2">Apply Template:</span>
                  {ROLES.map(role => {
                    const style = ROLE_STYLES[role];
                    return (
                      <button key={role} onClick={() => applyRoleTemplate(role)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:opacity-80 ${style.bg} ${style.text} ${style.border}`}>
                        {role}
                      </button>
                    );
                  })}
                </div>
                <PrivilegeMatrix privileges={editPrivileges} onChange={setEditPrivileges} />
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setPrivilegeModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={savePrivileges} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
                  <CheckCircle2 size={15} /> Save Privileges
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (embedded) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {pageContent}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {pageContent}
      </main>
    </div>
  );
}