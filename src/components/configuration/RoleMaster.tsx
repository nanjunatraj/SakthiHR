import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Plus, Pencil, Trash2, X, ChevronLeft, Lock, CheckCircle2,
  UserRound, LayoutDashboard, Loader2, Copy,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';
import { ALL_SECTIONS, type Section } from '../../lib/roleAccess';
import {
  listRoles, createRole, updateRole, deleteRole,
  privilegeTemplate, roleBadgeClasses, ROLE_COLORS, PRIVILEGE_MODULES,
  type RoleDef, type RoleInput, type RolePrivilege,
} from '../../lib/roles';

const inputCls = 'w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all';

const emptyPriv = (module: string): RolePrivilege => ({
  module, view: false, create: false, edit: false, delete: false, export: false, approve: false,
});

interface RoleFormData {
  name: string;
  description: string;
  isStaff: boolean;
  allAccess: boolean;
  sections: Section[];
  color: string;
  active: boolean;
  privileges: RolePrivilege[];
}

const emptyForm = (): RoleFormData => ({
  name: '', description: '', isStaff: true, allAccess: false, sections: [],
  color: 'blue', active: true, privileges: PRIVILEGE_MODULES.map(emptyPriv),
});

const PRIV_KEYS: (keyof Omit<RolePrivilege, 'module'>)[] = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

interface RoleMasterProps {
  embedded?: boolean;
  onBack?: () => void;
}

export default function RoleMaster({ embedded = false, onBack }: RoleMasterProps) {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<RoleDef | null>(null);
  const [form, setForm] = useState<RoleFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { roles, error } = await listRoles();
    if (error) toast.error(error);
    setRoles(roles);
    setLoading(false);
  };
  useEffect(() => { void refresh(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setModal(true);
  };

  const openEdit = (r: RoleDef) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description ?? '',
      isStaff: r.isStaff,
      allAccess: r.allAccess,
      sections: r.sections,
      color: r.color,
      active: r.active,
      // Show the effective template (stored or derived) so it can be tuned.
      privileges: privilegeTemplate(r),
    });
    setModal(true);
  };

  const openDuplicate = (r: RoleDef) => {
    setEditing(null);
    setForm({
      name: `${r.name} (Copy)`,
      description: r.description ?? '',
      isStaff: r.isStaff,
      allAccess: r.allAccess,
      sections: r.sections,
      color: r.color,
      active: true,
      privileges: privilegeTemplate(r),
    });
    setModal(true);
  };

  const toggleSection = (s: Section) =>
    setForm(f => ({ ...f, sections: f.sections.includes(s) ? f.sections.filter(x => x !== s) : [...f.sections, s] }));

  const togglePriv = (idx: number, key: keyof Omit<RolePrivilege, 'module'>) =>
    setForm(f => ({ ...f, privileges: f.privileges.map((p, i) => i === idx ? { ...p, [key]: !p[key] } : p) }));

  const save = async () => {
    const name = form.name.trim();
    if (!name) { toast.error('Role name is required.'); return; }
    const clash = roles.find(r => r.name.toLowerCase() === name.toLowerCase() && r.id !== editing?.id);
    if (clash) { toast.error('A role with this name already exists.'); return; }

    const input: RoleInput = {
      name,
      description: form.description,
      isStaff: form.isStaff,
      allAccess: form.allAccess,
      sections: form.sections,
      // Store the tuned template only for scoped roles; all-access derives itself.
      defaultPrivileges: form.allAccess ? [] : form.privileges,
      color: form.color,
      active: form.active,
    };

    setSaving(true);
    const { error } = editing
      ? await updateRole(editing.id, input)
      : await createRole(input);
    setSaving(false);
    if (error) { toast.error(error); return; }
    toast.success(editing ? 'Role updated.' : 'Role created.');
    setModal(false);
    void refresh();
  };

  const remove = async (r: RoleDef) => {
    if (r.isSystem) { toast.error('Built-in roles cannot be deleted.'); return; }
    if (!window.confirm(`Delete the "${r.name}" role? Users already assigned this role keep it until reassigned.`)) return;
    const { error } = await deleteRole(r.id);
    if (error) { toast.error(error); return; }
    toast.info('Role deleted.');
    void refresh();
  };

  const staffRoles = useMemo(() => roles.filter(r => r.isStaff), [roles]);
  const portalRoles = useMemo(() => roles.filter(r => !r.isStaff), [roles]);

  const renderRow = (r: RoleDef) => (
    <div key={r.id} className="bg-card rounded-xl border border-border shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${roleBadgeClasses(r.color)}`}>
        {r.isStaff ? <ShieldCheck size={18} /> : <UserRound size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${roleBadgeClasses(r.color)}`}>{r.name}</span>
          {r.isSystem && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-accent border border-border rounded-full px-2 py-0.5"><Lock size={9} /> Built-in</span>}
          {!r.active && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">Inactive</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{r.description || '—'}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {r.allAccess
            ? <span className="text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5">Full access</span>
            : r.isStaff
              ? (r.sections.length
                  ? r.sections.map(s => <span key={s} className="text-[10px] bg-accent text-muted-foreground border border-border rounded-full px-2 py-0.5">{s}</span>)
                  : <span className="text-[10px] text-muted-foreground italic">No sections</span>)
              : <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">Self-Service portal</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => openDuplicate(r)} title="Duplicate" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Copy size={14} /></button>
        <button onClick={() => openEdit(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
        <button onClick={() => remove(r)} disabled={r.isSystem} title={r.isSystem ? 'Built-in role — protected' : 'Delete'} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 size={14} /></button>
      </div>
    </div>
  );

  const content = (
    <>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {embedded && onBack && (
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={20} /></button>
            )}
            <div className="p-2 bg-rose-100 rounded-lg"><ShieldCheck size={22} className="text-rose-600" /></div>
            <div>
              <h1 className="text-xl font-bold">Role Master</h1>
              <p className="text-xs text-muted-foreground">Define roles — menu access and a default privilege template — then assign them in User Master.</p>
            </div>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium">
            <Plus size={16} /> Add Role
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {loading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading roles…</p>}

        {!loading && (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-primary" />
                <h2 className="text-sm font-bold">Admin Roles</h2>
                <span className="text-xs text-muted-foreground">Sign into the Admin app · {staffRoles.length}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{staffRoles.map(renderRow)}</div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <UserRound size={15} className="text-primary" />
                <h2 className="text-sm font-bold">Self-Service Roles</h2>
                <span className="text-xs text-muted-foreground">Employee portal only · {portalRoles.length}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{portalRoles.map(renderRow)}</div>
            </section>
          </>
        )}
      </div>

      {/* Role form modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">{editing ? `Edit Role — ${editing.name}` : 'Add Role'}</h2>
                <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {editing?.isSystem && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Lock size={13} /> Built-in role — its name is fixed, but access and the privilege template can be tuned.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Role Name <span className="text-destructive">*</span></label>
                    <input className={inputCls} placeholder="e.g. Recruiter" value={form.name}
                      disabled={editing?.isSystem}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">Description</label>
                    <input className={inputCls} placeholder="What this role is for" value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>

                {/* Workspace */}
                <div>
                  <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Workspace</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setForm(f => ({ ...f, isStaff: true }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${form.isStaff ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20'}`}>
                      <LayoutDashboard size={18} className="text-primary shrink-0" />
                      <div><p className="text-sm font-semibold">Admin app</p><p className="text-[10px] text-muted-foreground">Signs in with menu access</p></div>
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, isStaff: false }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition ${!form.isStaff ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/20'}`}>
                      <UserRound size={18} className="text-primary shrink-0" />
                      <div><p className="text-sm font-semibold">Self-Service</p><p className="text-[10px] text-muted-foreground">Employee portal only</p></div>
                    </button>
                  </div>
                </div>

                {/* Menu access (staff only) */}
                {form.isStaff && (
                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input type="checkbox" checked={form.allAccess} onChange={e => setForm(f => ({ ...f, allAccess: e.target.checked }))} />
                      <span className="text-sm font-semibold">Full access to every menu section</span>
                    </label>
                    {!form.allAccess && (
                      <div className="flex flex-wrap gap-2">
                        {ALL_SECTIONS.map(s => (
                          <button key={s} type="button" onClick={() => toggleSection(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.sections.includes(s) ? 'bg-primary text-primary-foreground border-primary' : 'bg-accent text-muted-foreground border-border hover:border-primary/40'}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Colour */}
                <div>
                  <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Badge colour</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${roleBadgeClasses(c)} ${form.color === c ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privilege template (scoped staff roles) */}
                {form.isStaff && !form.allAccess && (
                  <div>
                    <label className="block text-xs font-bold mb-2 text-muted-foreground uppercase tracking-wide">Default privilege template</label>
                    <p className="text-[11px] text-muted-foreground mb-2">Pre-fills a new user's module privileges when this role is assigned. Fully editable per user afterwards.</p>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-accent/50 text-muted-foreground uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-2.5 font-semibold">Module</th>
                            {PRIV_KEYS.map(k => <th key={k} className="px-3 py-2.5 font-semibold text-center capitalize">{k}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {form.privileges.map((p, i) => (
                            <tr key={p.module} className="hover:bg-accent/20">
                              <td className="px-3 py-2.5 font-medium">{p.module}</td>
                              {PRIV_KEYS.map(key => (
                                <td key={key} className="px-3 py-2.5 text-center">
                                  <button type="button" onClick={() => togglePriv(i, key)}
                                    className={`w-5 h-5 rounded flex items-center justify-center mx-auto transition-all ${p[key] ? 'bg-primary text-primary-foreground' : 'bg-accent border border-border text-transparent hover:border-primary/40'}`}>
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
                )}

                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  <span className="text-sm font-medium">Active (available for assignment)</span>
                </label>
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setModal(false)} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={() => void save()} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md disabled:opacity-60">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {editing ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{content}</main>
    </div>
  );
}
