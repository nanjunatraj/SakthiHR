import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Plus, Pencil, Trash2, X, ChevronLeft, Search,
  CheckCircle2, Users, Tag, Layers, Grid3X3, Award, Building2,
  ToggleLeft, Copy, Filter, Info, AlertCircle, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../Sidebar';
import BulkImport, { type CsvColumn } from './BulkImport';
import { useTable } from '../../hooks/useTable';

type HRMasterType =
  | 'designation'
  | 'employee-type'
  | 'employee-group'
  | 'employee-category'
  | 'employee-section'
  | 'employee-grade'
  | 'employee-classification';

// Each master type is backed by its own Supabase table.
const TABLE_FOR_TYPE: Record<HRMasterType, string> = {
  'designation': 'designations',
  'employee-type': 'employee_types',
  'employee-group': 'employee_groups',
  'employee-category': 'employee_categories',
  'employee-section': 'employee_sections',
  'employee-grade': 'employee_grades',
  'employee-classification': 'employee_classifications',
};

type DbRow = Record<string, unknown> & { id: string };

function formatCreatedAt(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Map a Supabase row → the UI's HRMasterItem shape. */
function rowToItem(row: DbRow): HRMasterItem {
  return {
    id: row.id,
    name: (row.name as string) ?? '',
    code: (row.code as string) ?? '',
    description: (row.description as string) ?? '',
    status: (row.status as 'Active' | 'Inactive') ?? 'Active',
    createdAt: formatCreatedAt(row.created_at),
    level: row.level as number | undefined,
    department: row.department as string | undefined,
    gradeLevel: row.grade_level as number | undefined,
    minSalary: row.min_salary as number | undefined,
    maxSalary: row.max_salary as number | undefined,
    isContractual: row.is_contractual as boolean | undefined,
    groupType: row.group_type as string | undefined,
    parentSection: row.parent_section as string | undefined,
  };
}

/** Map the UI form → a Supabase row, including only columns that exist on that table. */
function formToRow(type: HRMasterType, form: ItemFormData): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: form.name.trim(),
    code: form.code.trim(),
    description: form.description?.trim() || null,
    status: form.status,
  };
  if (type === 'designation') {
    base.level = form.level ?? null;
    base.department = form.department || null;
  } else if (type === 'employee-grade') {
    base.grade_level = form.gradeLevel ?? null;
    base.min_salary = form.minSalary ?? null;
    base.max_salary = form.maxSalary ?? null;
  } else if (type === 'employee-type') {
    base.is_contractual = form.isContractual ?? false;
  } else if (type === 'employee-group') {
    base.group_type = form.groupType || null;
  } else if (type === 'employee-section') {
    base.parent_section = form.parentSection || null;
  }
  return base;
}

// ─── CSV bulk-import schema per master type ─────────────────────────────────────

const BASE_CSV_COLUMNS: CsvColumn[] = [
  { header: 'Name', required: true, example: 'Sample Name' },
  { header: 'Code', required: true, example: 'CODE1' },
  { header: 'Description', example: 'Optional description' },
  { header: 'Status', example: 'Active', hint: 'Active or Inactive (defaults to Active)' },
];

const EXTRA_CSV_COLUMNS: Partial<Record<HRMasterType, CsvColumn[]>> = {
  'designation': [
    { header: 'Level', example: '3', hint: 'Hierarchy level (number)' },
    { header: 'Department', example: 'Engineering' },
  ],
  'employee-grade': [
    { header: 'Grade Level', example: '2', hint: 'Number' },
    { header: 'Min Salary', example: '30000', hint: 'Number' },
    { header: 'Max Salary', example: '60000', hint: 'Number' },
  ],
  'employee-type': [
    { header: 'Is Contractual', example: 'No', hint: 'Yes or No' },
  ],
  'employee-group': [
    { header: 'Group Type', example: 'Payroll' },
  ],
  'employee-section': [
    { header: 'Parent Section', example: 'Operations' },
  ],
};

/** Full ordered CSV column list (template headers) for a master type. */
function csvColumnsForType(type: HRMasterType): CsvColumn[] {
  return [...BASE_CSV_COLUMNS, ...(EXTRA_CSV_COLUMNS[type] ?? [])];
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));
const bool = (v: string) => /^(yes|true|1|y)$/i.test(v.trim());

/** Map one parsed CSV row (keyed by declared header) → a DB insert object,
 *  or return `{ error }` describing why the row is invalid. */
function csvRowToDbRow(type: HRMasterType, cells: Record<string, string>): Record<string, unknown> | { error: string } {
  const statusRaw = (cells['Status'] || 'Active').trim();
  const status = /^inactive$/i.test(statusRaw) ? 'Inactive' : /^active$/i.test(statusRaw) ? 'Active' : null;
  if (!status) return { error: `Invalid Status "${statusRaw}" (use Active or Inactive)` };

  const row: Record<string, unknown> = {
    name: cells['Name'].trim(),
    code: cells['Code'].trim(),
    description: cells['Description']?.trim() || null,
    status,
  };

  if (type === 'designation') {
    if (cells['Level'] && isNaN(num(cells['Level']) as number)) return { error: `Level "${cells['Level']}" is not a number` };
    row.level = num(cells['Level'] || '');
    row.department = cells['Department']?.trim() || null;
  } else if (type === 'employee-grade') {
    for (const k of ['Grade Level', 'Min Salary', 'Max Salary']) {
      if (cells[k] && isNaN(num(cells[k]) as number)) return { error: `${k} "${cells[k]}" is not a number` };
    }
    row.grade_level = num(cells['Grade Level'] || '');
    row.min_salary = num(cells['Min Salary'] || '');
    row.max_salary = num(cells['Max Salary'] || '');
  } else if (type === 'employee-type') {
    row.is_contractual = bool(cells['Is Contractual'] || '');
  } else if (type === 'employee-group') {
    row.group_type = cells['Group Type']?.trim() || null;
  } else if (type === 'employee-section') {
    row.parent_section = cells['Parent Section']?.trim() || null;
  }
  return row;
}

interface HRMasterItem {
  id: string;
  name: string;
  code: string;
  description: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  level?: number;
  department?: string;
  gradeLevel?: number;
  minSalary?: number;
  maxSalary?: number;
  isContractual?: boolean;
  groupType?: string;
  parentSection?: string;
}

interface HRMasterModule {
  key: HRMasterType;
  title: string;
  singularTitle: string;
  description: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  tags: string[];
}

const HR_MASTER_MODULES: HRMasterModule[] = [
  {
    key: 'designation',
    title: 'Designation',
    singularTitle: 'Designation',
    description: 'Define job titles and designations across departments and hierarchy levels.',
    icon: Briefcase,
    color: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    tags: ['Job Titles', 'Hierarchy', 'Departments'],
  },
  {
    key: 'employee-type',
    title: 'Employee Type',
    singularTitle: 'Employee Type',
    description: 'Classify employees by employment nature — permanent, contract, intern, etc.',
    icon: Tag,
    color: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
    tags: ['Permanent', 'Contract', 'Intern'],
  },
  {
    key: 'employee-group',
    title: 'Employee Group',
    singularTitle: 'Employee Group',
    description: 'Group employees for payroll, benefits, and policy application purposes.',
    icon: Users,
    color: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentText: 'text-violet-700',
    accentBorder: 'border-violet-200',
    tags: ['Payroll Groups', 'Benefits', 'Policies'],
  },
  {
    key: 'employee-category',
    title: 'Employee Category',
    singularTitle: 'Employee Category',
    description: 'Categorize employees for statutory compliance and reporting requirements.',
    icon: Layers,
    color: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-200',
    tags: ['Statutory', 'Compliance', 'Reporting'],
  },
  {
    key: 'employee-section',
    title: 'Employee Section',
    singularTitle: 'Employee Section',
    description: 'Define sections within departments for granular organizational structure.',
    icon: Grid3X3,
    color: 'bg-rose-100',
    iconColor: 'text-rose-600',
    accentBg: 'bg-rose-50',
    accentText: 'text-rose-700',
    accentBorder: 'border-rose-200',
    tags: ['Sub-departments', 'Teams', 'Units'],
  },
  {
    key: 'employee-grade',
    title: 'Employee Grade',
    singularTitle: 'Employee Grade',
    description: 'Set salary grades and pay bands for structured compensation management.',
    icon: Award,
    color: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
    accentBg: 'bg-cyan-50',
    accentText: 'text-cyan-700',
    accentBorder: 'border-cyan-200',
    tags: ['Pay Bands', 'Salary Range', 'Compensation'],
  },
  {
    key: 'employee-classification',
    title: 'Employee Classification',
    singularTitle: 'Employee Classification',
    description: 'Define statutory labour-law classifications — Employee, Worker, Apprentice, Contract Labour, etc.',
    icon: ShieldCheck,
    color: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    accentBg: 'bg-indigo-50',
    accentText: 'text-indigo-700',
    accentBorder: 'border-indigo-200',
    tags: ['Worker', 'Apprentice', 'Contract Labour'],
  },
];

function formatCurrency(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
}

const inputCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all";
const selectCls = "w-full p-3 bg-accent/50 border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all appearance-none";

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

const Field = ({ label, required, children, hint }: FieldProps) => (
  <div>
    <label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase tracking-wide">
      {label} {required && <span className="text-destructive">*</span>}
    </label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
  </div>
);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal = ({ title, onClose, children }: ModalProps) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
          <X size={20} />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

interface ItemFormData {
  name: string;
  code: string;
  description: string;
  status: 'Active' | 'Inactive';
  level?: number;
  department?: string;
  gradeLevel?: number;
  minSalary?: number;
  maxSalary?: number;
  isContractual?: boolean;
  groupType?: string;
  parentSection?: string;
}

const emptyForm = (type: HRMasterType): ItemFormData => ({
  name: '',
  code: '',
  description: '',
  status: 'Active',
  ...(type === 'designation' ? { level: 1, department: '' } : {}),
  ...(type === 'employee-grade' ? { gradeLevel: 1, minSalary: 0, maxSalary: 0 } : {}),
  ...(type === 'employee-type' ? { isContractual: false } : {}),
  ...(type === 'employee-group' ? { groupType: 'Payroll' } : {}),
  ...(type === 'employee-section' ? { parentSection: '' } : {}),
});

interface ItemFormModalProps {
  title: string;
  type: HRMasterType;
  form: ItemFormData;
  onChange: (key: keyof ItemFormData, value: any) => void;
  onSave: () => void;
  onClose: () => void;
  saveLabel: string;
  module: HRMasterModule;
}

const ItemFormModal = ({ title, type, form, onChange, onSave, onClose, saveLabel, module }: ItemFormModalProps) => {
  const Icon = module.icon;
  return (
    <Modal title={title} onClose={onClose}>
      <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className={`flex items-center gap-3 p-3 ${module.accentBg} border ${module.accentBorder} rounded-xl`}>
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Icon size={16} className={module.iconColor} />
          </div>
          <p className={`text-xs font-medium ${module.accentText}`}>{module.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label={`${module.singularTitle} Name`} required>
              <input
                type="text"
                className={inputCls}
                placeholder={`e.g. ${type === 'designation' ? 'Senior Engineer' : type === 'employee-type' ? 'Permanent' : type === 'employee-group' ? 'Technical Staff' : type === 'employee-category' ? 'General' : type === 'employee-section' ? 'Frontend Dev' : 'Grade A1'}`}
                value={form.name}
                onChange={e => onChange('name', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Code" required hint="Short unique identifier">
            <input
              type="text"
              className={`${inputCls} font-mono uppercase`}
              placeholder="e.g. SE"
              maxLength={10}
              value={form.code}
              onChange={e => onChange('code', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Status">
            <select
              className={selectCls}
              value={form.status}
              onChange={e => onChange('status', e.target.value as 'Active' | 'Inactive')}
            >
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              <textarea
                className={`${inputCls} resize-none`}
                rows={2}
                placeholder="Brief description"
                value={form.description}
                onChange={e => onChange('description', e.target.value)}
              />
            </Field>
          </div>

          {type === 'designation' && (
            <>
              <Field label="Hierarchy Level" hint="1 = Entry, higher = Senior">
                <input
                  type="number"
                  className={inputCls}
                  min={1}
                  max={10}
                  value={form.level ?? 1}
                  onChange={e => onChange('level', parseInt(e.target.value) || 1)}
                />
              </Field>
              <Field label="Primary Department">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Engineering"
                  value={form.department ?? ''}
                  onChange={e => onChange('department', e.target.value)}
                />
              </Field>
            </>
          )}

          {type === 'employee-grade' && (
            <>
              <Field label="Grade Level" hint="Numeric rank (1 = lowest)">
                <input
                  type="number"
                  className={inputCls}
                  min={1}
                  max={20}
                  value={form.gradeLevel ?? 1}
                  onChange={e => onChange('gradeLevel', parseInt(e.target.value) || 1)}
                />
              </Field>
              <div />
              <Field label="Min Annual Salary (₹)" hint="Minimum CTC for this grade">
                <input
                  type="number"
                  className={inputCls}
                  min={0}
                  step={10000}
                  value={form.minSalary ?? 0}
                  onChange={e => onChange('minSalary', parseInt(e.target.value) || 0)}
                />
              </Field>
              <Field label="Max Annual Salary (₹)" hint="Maximum CTC for this grade">
                <input
                  type="number"
                  className={inputCls}
                  min={0}
                  step={10000}
                  value={form.maxSalary ?? 0}
                  onChange={e => onChange('maxSalary', parseInt(e.target.value) || 0)}
                />
              </Field>
              {(form.minSalary ?? 0) > 0 && (form.maxSalary ?? 0) > 0 && (form.minSalary ?? 0) > (form.maxSalary ?? 0) && (
                <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                  <AlertCircle size={12} /> Min salary cannot exceed max salary.
                </div>
              )}
            </>
          )}

          {type === 'employee-type' && (
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => onChange('isContractual', !form.isContractual)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.isContractual ? 'bg-primary' : 'bg-border'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isContractual ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <div>
                  <span className="text-sm font-medium">Contractual Employment</span>
                  <p className="text-[10px] text-muted-foreground">This type represents a fixed-term or contractual arrangement</p>
                </div>
              </label>
            </div>
          )}

          {type === 'employee-group' && (
            <div className="col-span-2">
              <Field label="Group Type" hint="Purpose of this employee group">
                <select
                  className={selectCls}
                  value={form.groupType ?? 'Payroll'}
                  onChange={e => onChange('groupType', e.target.value)}
                >
                  <option>Payroll</option>
                  <option>Incentive</option>
                  <option>Allowance</option>
                  <option>Benefits</option>
                  <option>Compliance</option>
                  <option>Other</option>
                </select>
              </Field>
            </div>
          )}

          {type === 'employee-section' && (
            <div className="col-span-2">
              <Field label="Parent Department / Section" hint="The department this section belongs to">
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Engineering, Human Resources"
                  value={form.parentSection ?? ''}
                  onChange={e => onChange('parentSection', e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </div>
      <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
        <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button onClick={onSave} className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-md">
          {saveLabel}
        </button>
      </div>
    </Modal>
  );
};

interface ItemRowProps {
  item: HRMasterItem;
  index: number;
  type: HRMasterType;
  module: HRMasterModule;
  onEdit: (item: HRMasterItem) => void;
  onDelete: (id: string) => void;
  onDuplicate: (item: HRMasterItem) => void;
  onToggleStatus: (id: string) => void;
}

const ItemRow = ({ item, index, type, module, onEdit, onDelete, onDuplicate, onToggleStatus }: ItemRowProps) => {
  const Icon = module.icon;
  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="hover:bg-accent/30 transition-colors group"
    >
      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{index + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${module.color} flex items-center justify-center shrink-0`}>
            <Icon size={13} className={module.iconColor} />
          </div>
          <div>
            <p className="font-semibold text-sm">{item.name}</p>
            {item.description && (
              <p className="text-[10px] text-muted-foreground truncate max-w-[220px]">{item.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono font-bold bg-accent border border-border px-2 py-0.5 rounded">{item.code}</span>
      </td>
      <td className="px-4 py-3">
        {type === 'designation' && item.level !== undefined && (
          <div>
            <span className="text-xs font-medium">Level {item.level}</span>
            {item.department && <p className="text-[10px] text-muted-foreground">{item.department}</p>}
          </div>
        )}
        {type === 'employee-grade' && item.gradeLevel !== undefined && (
          <div>
            <span className="text-xs font-medium">Grade {item.gradeLevel}</span>
            {item.minSalary !== undefined && item.maxSalary !== undefined && (
              <p className="text-[10px] text-muted-foreground">{formatCurrency(item.minSalary)} – {formatCurrency(item.maxSalary)}</p>
            )}
          </div>
        )}
        {type === 'employee-type' && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.isContractual ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
            {item.isContractual ? 'Contractual' : 'Regular'}
          </span>
        )}
        {type === 'employee-group' && item.groupType && (
          <span className="text-xs font-medium text-muted-foreground bg-accent border border-border px-2 py-0.5 rounded-full">{item.groupType}</span>
        )}
        {type === 'employee-section' && item.parentSection && (
          <span className="text-xs text-muted-foreground">{item.parentSection}</span>
        )}
        {type === 'employee-category' && (
          <span className="text-[10px] text-muted-foreground">Statutory</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.createdAt}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggleStatus(item.id)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
            item.status === 'Active'
              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {item.status}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDuplicate(item)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
            <Copy size={13} />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

interface MasterViewProps {
  type: HRMasterType;
  module: HRMasterModule;
  items: HRMasterItem[];
  loading: boolean;
  onBack: () => void;
  onCreate: (form: ItemFormData) => Promise<string | null>;
  onSave: (id: string, form: ItemFormData) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  /** Insert a raw DB row produced from a CSV import (bypasses the form). */
  onImportRow: (row: Record<string, unknown>) => Promise<string | null>;
}

const MasterView = ({ type, module, items, loading, onBack, onCreate, onSave, onDelete, onImportRow }: MasterViewProps) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<HRMasterItem | null>(null);
  const [form, setForm] = useState<ItemFormData>(emptyForm(type));

  const Icon = module.icon;

  const filtered = useMemo(() =>
    items
      .filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()))
      .filter(i => statusFilter === 'All' || i.status === statusFilter),
    [items, search, statusFilter]
  );

  const activeCount = items.filter(i => i.status === 'Active').length;

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm(type));
    setModal(true);
  };

  const openEdit = (item: HRMasterItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      code: item.code,
      description: item.description,
      status: item.status,
      level: item.level,
      department: item.department,
      gradeLevel: item.gradeLevel,
      minSalary: item.minSalary,
      maxSalary: item.maxSalary,
      isContractual: item.isContractual,
      groupType: item.groupType,
      parentSection: item.parentSection,
    });
    setModal(true);
  };

  const handleDuplicate = (item: HRMasterItem) => {
    setEditingItem(null);
    setForm({
      name: `${item.name} (Copy)`,
      code: `${item.code}2`,
      description: item.description,
      status: 'Inactive',
      level: item.level,
      department: item.department,
      gradeLevel: item.gradeLevel,
      minSalary: item.minSalary,
      maxSalary: item.maxSalary,
      isContractual: item.isContractual,
      groupType: item.groupType,
      parentSection: item.parentSection,
    });
    setModal(true);
    toast.info('Duplicated — review and save.');
  };

  const [saving, setSaving] = useState(false);

  const saveItem = async () => {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.code.trim()) { toast.error('Code is required.'); return; }

    const codeExists = items.some(i => i.code === form.code && (editingItem ? i.id !== editingItem.id : true));
    if (codeExists) { toast.error('Code already exists. Please use a unique code.'); return; }

    if (type === 'employee-grade' && (form.minSalary ?? 0) > (form.maxSalary ?? 0) && (form.maxSalary ?? 0) > 0) {
      toast.error('Min salary cannot exceed max salary.'); return;
    }

    setSaving(true);
    const err = editingItem
      ? await onSave(editingItem.id, form)
      : await onCreate(form);
    setSaving(false);

    if (err) { toast.error(err); return; }
    toast.success(`${module.singularTitle} ${editingItem ? 'updated' : 'added'}.`);
    setModal(false);
  };

  const deleteItem = async (id: string) => {
    const err = await onDelete(id);
    if (err) { toast.error(err); return; }
    toast.info(`${module.singularTitle} deleted.`);
  };

  const toggleStatus = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const err = await onSave(id, { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } as ItemFormData);
    if (err) toast.error(err);
  };

  const extraColLabel = () => {
    if (type === 'designation') return 'Level / Dept';
    if (type === 'employee-grade') return 'Grade / Salary Range';
    if (type === 'employee-type') return 'Employment Nature';
    if (type === 'employee-group') return 'Group Type';
    if (type === 'employee-section') return 'Parent Dept';
    return 'Category Type';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className={`p-2 ${module.color} rounded-lg`}>
                <Icon size={22} className={module.iconColor} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{module.title} Master</h1>
                <p className="text-xs text-muted-foreground">{module.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BulkImport
                title={module.singularTitle}
                columns={csvColumnsForType(type)}
                toRecord={(cells) => {
                  const row = csvRowToDbRow(type, cells);
                  if ('error' in row) return row;
                  if (items.some(i => i.code.toLowerCase() === String(row.code).toLowerCase())) {
                    return { error: `Code "${row.code}" already exists` };
                  }
                  return row;
                }}
                insertRecord={onImportRow}
              />
              <button
                onClick={openAdd}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-md text-sm font-medium"
              >
                <Plus size={16} /> Add {module.singularTitle}
              </button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className={`p-2.5 ${module.color} rounded-xl`}><Icon size={20} className={module.iconColor} /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total</p>
                <p className="font-bold text-lg mt-0.5">{items.length}</p>
                <p className="text-[10px] text-muted-foreground">{module.singularTitle} records</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-green-100 rounded-xl"><CheckCircle2 size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active</p>
                <p className="font-bold text-lg mt-0.5">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">{items.length - activeCount} inactive</p>
              </div>
            </motion.div>
            {type === 'employee-grade' && (
              <>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2.5 bg-cyan-100 rounded-xl"><Award size={20} className="text-cyan-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Min CTC</p>
                    <p className="font-bold text-lg mt-0.5">{formatCurrency(Math.min(...items.map(i => i.minSalary ?? 0)))}</p>
                    <p className="text-[10px] text-muted-foreground">Lowest grade</p>
                  </div>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2.5 bg-cyan-100 rounded-xl"><Award size={20} className="text-cyan-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Max CTC</p>
                    <p className="font-bold text-lg mt-0.5">{formatCurrency(Math.max(...items.map(i => i.maxSalary ?? 0)))}</p>
                    <p className="text-[10px] text-muted-foreground">Highest grade</p>
                  </div>
                </motion.div>
              </>
            )}
            {type === 'employee-type' && (
              <>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2.5 bg-blue-100 rounded-xl"><Tag size={20} className="text-blue-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Regular</p>
                    <p className="font-bold text-lg mt-0.5">{items.filter(i => !i.isContractual).length}</p>
                    <p className="text-[10px] text-muted-foreground">Employment types</p>
                  </div>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2.5 bg-amber-100 rounded-xl"><Tag size={20} className="text-amber-600" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Contractual</p>
                    <p className="font-bold text-lg mt-0.5">{items.filter(i => i.isContractual).length}</p>
                    <p className="text-[10px] text-muted-foreground">Employment types</p>
                  </div>
                </motion.div>
              </>
            )}
            {(type === 'designation' || type === 'employee-group' || type === 'employee-category' || type === 'employee-section') && (
              <>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className={`p-2.5 ${module.color} rounded-xl`}><Icon size={20} className={module.iconColor} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Filtered</p>
                    <p className="font-bold text-lg mt-0.5">{filtered.length}</p>
                    <p className="text-[10px] text-muted-foreground">Matching records</p>
                  </div>
                </motion.div>
                <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2.5 bg-gray-100 rounded-xl"><ToggleLeft size={20} className="text-gray-500" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Inactive</p>
                    <p className="font-bold text-lg mt-0.5">{items.length - activeCount}</p>
                    <p className="text-[10px] text-muted-foreground">Disabled records</p>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder={`Search ${module.title.toLowerCase()} by name or code...`}
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-4 py-2 border border-border rounded-lg bg-card outline-none text-sm appearance-none"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            >
              <option value="All">All Status</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} className="text-green-500" />
              <span>{filtered.length} of {items.length} records</span>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-10">#</th>
                      <th className="px-4 py-3 font-semibold">{module.singularTitle}</th>
                      <th className="px-4 py-3 font-semibold">Code</th>
                      <th className="px-4 py-3 font-semibold">{extraColLabel()}</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((item, i) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        index={i}
                        type={type}
                        module={module}
                        onEdit={openEdit}
                        onDelete={deleteItem}
                        onDuplicate={handleDuplicate}
                        onToggleStatus={toggleStatus}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-accent/20 rounded-xl border-2 border-dashed border-border">
              <div className={`w-16 h-16 ${module.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <Icon size={28} className={module.iconColor} />
              </div>
              <p className="font-semibold text-muted-foreground">
                {search || statusFilter !== 'All' ? `No ${module.title.toLowerCase()} match your filters` : `No ${module.title.toLowerCase()} defined yet`}
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-5">
                {search || statusFilter !== 'All' ? 'Try adjusting your search or filter criteria' : `Add your first ${module.singularTitle.toLowerCase()} to get started`}
              </p>
              {!search && statusFilter === 'All' && (
                <button
                  onClick={openAdd}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm text-sm font-medium mx-auto"
                >
                  <Plus size={15} /> Add {module.singularTitle}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {modal && (
          <ItemFormModal
            title={editingItem ? `Edit ${module.singularTitle} — ${editingItem.name}` : `Add ${module.singularTitle}`}
            type={type}
            form={form}
            onChange={(key, val) => setForm(f => ({ ...f, [key]: val }))}
            onSave={saveItem}
            onClose={() => setModal(false)}
            saveLabel={editingItem ? 'Save Changes' : `Add ${module.singularTitle}`}
            module={module}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface HRMastersProps {
  onBack: () => void;
}

export default function HRMasters({ onBack }: HRMastersProps) {
  const [activeModule, setActiveModule] = useState<HRMasterType | null>(null);

  // Each master type is loaded live from its Supabase table with Realtime, so
  // edits persist and sync across devices. One hook per type (fixed count).
  const ordering = { column: 'created_at', ascending: true } as const;
  const designations = useTable<DbRow>('designations', { orderBy: ordering });
  const employeeTypes = useTable<DbRow>('employee_types', { orderBy: ordering });
  const employeeGroups = useTable<DbRow>('employee_groups', { orderBy: ordering });
  const employeeCategories = useTable<DbRow>('employee_categories', { orderBy: ordering });
  const employeeSections = useTable<DbRow>('employee_sections', { orderBy: ordering });
  const employeeGrades = useTable<DbRow>('employee_grades', { orderBy: ordering });
  const employeeClassifications = useTable<DbRow>('employee_classifications', { orderBy: ordering });

  const tableFor: Record<HRMasterType, ReturnType<typeof useTable<DbRow>>> = {
    'designation': designations,
    'employee-type': employeeTypes,
    'employee-group': employeeGroups,
    'employee-category': employeeCategories,
    'employee-section': employeeSections,
    'employee-grade': employeeGrades,
    'employee-classification': employeeClassifications,
  };

  const data = useMemo(() => ({
    'designation': designations.rows.map(rowToItem),
    'employee-type': employeeTypes.rows.map(rowToItem),
    'employee-group': employeeGroups.rows.map(rowToItem),
    'employee-category': employeeCategories.rows.map(rowToItem),
    'employee-section': employeeSections.rows.map(rowToItem),
    'employee-grade': employeeGrades.rows.map(rowToItem),
    'employee-classification': employeeClassifications.rows.map(rowToItem),
  } as Record<HRMasterType, HRMasterItem[]>), [
    designations.rows, employeeTypes.rows, employeeGroups.rows,
    employeeCategories.rows, employeeSections.rows, employeeGrades.rows,
    employeeClassifications.rows,
  ]);

  if (activeModule) {
    const module = HR_MASTER_MODULES.find(m => m.key === activeModule)!;
    const t = tableFor[activeModule];
    return (
      <MasterView
        type={activeModule}
        module={module}
        items={data[activeModule]}
        loading={t.loading}
        onBack={() => setActiveModule(null)}
        onCreate={async (form) => (await t.insert(formToRow(activeModule, form))).error}
        onSave={async (id, form) => (await t.update(id, formToRow(activeModule, form))).error}
        onDelete={async (id) => (await t.remove(id)).error}
        onImportRow={async (row) => (await t.insert(row)).error}
      />
    );
  }

  const totalRecords = Object.values(data).reduce((s, arr) => s + arr.length, 0);
  const totalActive = Object.values(data).reduce((s, arr) => s + arr.filter(i => i.status === 'Active').length, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Building2 size={22} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">HR Masters</h1>
              <p className="text-xs text-muted-foreground">Configure designations, employee types, groups, categories, sections, and grades.</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-indigo-100 rounded-xl"><Building2 size={20} className="text-indigo-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Master Types</p>
                <p className="font-bold text-lg mt-0.5">{HR_MASTER_MODULES.length}</p>
                <p className="text-[10px] text-muted-foreground">HR master modules</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-100 rounded-xl"><Layers size={20} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Records</p>
                <p className="font-bold text-lg mt-0.5">{totalRecords}</p>
                <p className="text-[10px] text-muted-foreground">Across all masters</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-green-100 rounded-xl"><CheckCircle2 size={20} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Records</p>
                <p className="font-bold text-lg mt-0.5">{totalActive}</p>
                <p className="text-[10px] text-muted-foreground">{totalRecords - totalActive} inactive</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -3 }} className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-100 rounded-xl"><Award size={20} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Grade Levels</p>
                <p className="font-bold text-lg mt-0.5">{data['employee-grade'].length}</p>
                <p className="text-[10px] text-muted-foreground">Pay grades defined</p>
              </div>
            </motion.div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <Info size={17} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">HR Masters — Foundation Data</p>
              <p className="text-xs text-blue-700 mt-0.5">
                These masters form the foundational reference data used across the HRMS — in employee profiles, payroll configuration, leave policies, and statutory compliance. Ensure all records are accurate before onboarding employees.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {HR_MASTER_MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const moduleData = data[mod.key];
              const activeItems = moduleData.filter(d => d.status === 'Active').length;
              return (
                <motion.button
                  key={mod.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setActiveModule(mod.key)}
                  className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all p-6 text-left group overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 ${mod.color} rounded-xl`}>
                      <Icon size={24} className={mod.iconColor} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        {activeItems} active
                      </span>
                      <span className="text-[10px] font-bold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                        {moduleData.length} total
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors">{mod.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{mod.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {mod.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-semibold bg-accent text-muted-foreground border border-border px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>

                  <div className={`p-3 ${mod.accentBg} border ${mod.accentBorder} rounded-lg`}>
                    <div className="flex flex-wrap gap-1">
                      {moduleData.filter(d => d.status === 'Active').slice(0, 4).map(item => (
                        <span key={item.id} className={`text-[10px] font-semibold ${mod.accentBg} ${mod.accentText} border ${mod.accentBorder} px-2 py-0.5 rounded-full`}>
                          {item.code}
                        </span>
                      ))}
                      {activeItems > 4 && (
                        <span className={`text-[10px] font-semibold ${mod.accentText}`}>+{activeItems - 4} more</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">Click to manage</span>
                    <span className={`text-xs font-semibold ${mod.iconColor} group-hover:underline`}>Open →</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-accent/20 flex items-center gap-3">
              <Layers size={16} className="text-primary" />
              <h3 className="font-bold text-sm">HR Masters Summary</h3>
              <span className="ml-auto text-xs text-muted-foreground">{totalRecords} total records across {HR_MASTER_MODULES.length} masters</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-accent/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Master</th>
                    <th className="px-4 py-3 font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Active</th>
                    <th className="px-4 py-3 font-semibold">Inactive</th>
                    <th className="px-4 py-3 font-semibold">Coverage</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {HR_MASTER_MODULES.map((mod, i) => {
                    const Icon = mod.icon;
                    const moduleData = data[mod.key];
                    const active = moduleData.filter(d => d.status === 'Active').length;
                    const pct = moduleData.length > 0 ? Math.round((active / moduleData.length) * 100) : 0;
                    return (
                      <motion.tr
                        key={mod.key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg ${mod.color} flex items-center justify-center shrink-0`}>
                              <Icon size={14} className={mod.iconColor} />
                            </div>
                            <span className="font-semibold text-sm">{mod.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-sm">{moduleData.length}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-green-600">{active}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">{moduleData.length - active}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-accent rounded-full">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setActiveModule(mod.key)}
                            className={`text-xs font-semibold ${mod.iconColor} hover:underline`}
                          >
                            Manage →
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}