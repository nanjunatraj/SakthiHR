import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserSquare, ChevronLeft, Search, Eye, User, MapPin, Briefcase,
  IdCard, Users as UsersIcon, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../supabase/client';
import { useEstablishment } from '../../lib/reports';
import ReportViewModal from '../../components/ReportViewModal';
import type { StatementDoc } from '../../lib/exportStatement';

const db = supabase as unknown as SupabaseClient;

const PROFILE_SELECT =
  'id, employee_id, current_employee_id, service_book_no, first_name, middle_name, last_name, ' +
  'father_name, mother_name, date_of_birth, place_of_birth, nationality, identification_marks, ' +
  'gender, marital_status, blood_group, religion, caste, mother_tongue, ' +
  'present_address_line1, present_address_line2, present_city, present_district, present_state, present_pincode, present_country, ' +
  'permanent_address_line1, permanent_address_line2, permanent_city, permanent_district, permanent_state, permanent_pincode, permanent_country, same_address, ' +
  'mobile_number, email, date_of_joining, date_of_confirmation, probation_period_months, notice_period_days, ' +
  'section, employee_classification, tax_regime, status, anniversary_date, relieving_date, ' +
  'total_experience_years, total_experience_months, reporting_manager_id, ' +
  'designation:designations(name), department:departments(name), work_location:work_locations(name), ' +
  'employee_type:employee_types(name), grade:employee_grades(name), category:employee_categories(name), ' +
  'employee_group:employee_groups(name), shift:shifts(name)';

interface ProfileRow { [key: string]: any; }

const fullName = (r: ProfileRow | null | undefined) =>
  r ? [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ') : '';

const dash = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

const composeAddress = (r: ProfileRow, p: 'present' | 'permanent') =>
  [r[`${p}_address_line1`], r[`${p}_address_line2`], r[`${p}_city`], r[`${p}_district`], r[`${p}_state`], r[`${p}_pincode`], r[`${p}_country`]]
    .filter(Boolean).join(', ') || '—';

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function EmployeeProfileReport() {
  const navigate = useNavigate();
  const est = useEstablishment();

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showView, setShowView] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await db.from('employees').select(PROFILE_SELECT).order('first_name');
      if (!active) return;
      if (error) { console.warn('[employee-profile] load failed:', error.message); setRows([]); }
      else setRows((data ?? []) as ProfileRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      fullName(r).toLowerCase().includes(q) ||
      String(r.employee_id ?? '').toLowerCase().includes(q));
  }, [rows, search]);

  // Default-select the first employee once loaded.
  useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);
  const manager = useMemo(
    () => (selected?.reporting_manager_id ? rows.find(r => r.id === selected.reporting_manager_id) ?? null : null),
    [rows, selected]);

  // Build the key/value pairs grouped into sections (shared by the screen + the print doc).
  const sections = useMemo(() => {
    if (!selected) return [] as { title: string; icon: any; rows: [string, string][] }[];
    const s = selected;
    return [
      {
        title: 'Personal Details', icon: User, rows: [
          ['Employee Name', fullName(s)],
          ['Employee ID', dash(s.employee_id)],
          ['Current Employee ID', dash(s.current_employee_id)],
          ['Father’s Name', dash(s.father_name)],
          ['Mother’s Name', dash(s.mother_name)],
          ['Date of Birth', formatDateDisplay(s.date_of_birth)],
          ['Place of Birth', dash(s.place_of_birth)],
          ['Gender', dash(s.gender)],
          ['Marital Status', dash(s.marital_status)],
          ['Blood Group', dash(s.blood_group)],
          ['Nationality', dash(s.nationality)],
        ] as [string, string][],
      },
      {
        title: 'Identity & Background', icon: IdCard, rows: [
          ['Religion', dash(s.religion)],
          ['Caste', dash(s.caste)],
          ['Mother Tongue', dash(s.mother_tongue)],
          ['Identification Marks', dash(s.identification_marks)],
          ['Service Book No.', dash(s.service_book_no)],
        ] as [string, string][],
      },
      {
        title: 'Contact & Address', icon: MapPin, rows: [
          ['Mobile Number', dash(s.mobile_number)],
          ['Email', dash(s.email)],
          ['Present Address', composeAddress(s, 'present')],
          ['Permanent Address', s.same_address ? 'Same as present address' : composeAddress(s, 'permanent')],
        ] as [string, string][],
      },
      {
        title: 'Employment Details', icon: Briefcase, rows: [
          ['Designation', dash(s.designation?.name)],
          ['Department', dash(s.department?.name)],
          ['Section', dash(s.section)],
          ['Grade', dash(s.grade?.name)],
          ['Employee Type', dash(s.employee_type?.name)],
          ['Category', dash(s.category?.name)],
          ['Employee Group', dash(s.employee_group?.name)],
          ['Work Location', dash(s.work_location?.name)],
          ['Shift', dash(s.shift?.name)],
          ['Classification', dash(s.employee_classification)],
          ['Tax Regime', dash(s.tax_regime)],
          ['Status', dash(s.status)],
        ] as [string, string][],
      },
      {
        title: 'Service & Reporting', icon: UsersIcon, rows: [
          ['Date of Joining', formatDateDisplay(s.date_of_joining)],
          ['Date of Confirmation', formatDateDisplay(s.date_of_confirmation)],
          ['Probation Period', s.probation_period_months != null ? `${s.probation_period_months} months` : '—'],
          ['Notice Period', s.notice_period_days != null ? `${s.notice_period_days} days` : '—'],
          ['Total Experience', `${s.total_experience_years ?? 0} yrs ${s.total_experience_months ?? 0} mos`],
          ['Anniversary Date', formatDateDisplay(s.anniversary_date)],
          ['Relieving Date', formatDateDisplay(s.relieving_date)],
          ['Reporting Manager', manager ? `${fullName(manager)} (${dash(manager.employee_id)})` : '—'],
        ] as [string, string][],
      },
    ];
  }, [selected, manager]);

  const reportDoc: StatementDoc = useMemo(() => ({
    title: 'Employee Profile Report',
    establishment: est.name,
    subtitle: selected ? `${fullName(selected)} · ${dash(selected.employee_id)}` : '',
    columns: [
      { key: 'field', label: 'Field', text: true },
      { key: 'value', label: 'Details', text: true },
    ],
    rows: sections.flatMap(sec => [
      { field: `— ${sec.title} —`, value: '' },
      ...sec.rows.map(([field, value]) => ({ field, value })),
    ]),
    note: 'Computer-generated Employee Profile Report.',
  }), [sections, est.name, selected]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/reports/g/employee')} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft size={20} />
              </button>
              <div className="p-2 bg-blue-100 rounded-lg"><UserSquare size={22} className="text-blue-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Employee Profile Report</h1>
                <p className="text-xs text-muted-foreground">Full personal, contact and employment profile of an employee.</p>
              </div>
            </div>
            <button
              onClick={() => setShowView(true)}
              disabled={!selected}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <Eye size={15} /> View / Print
            </button>
          </div>
        </div>

        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Employee Picker */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 h-fit lg:sticky lg:top-24">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text" placeholder="Search employees..."
                className="w-full pl-9 pr-4 py-2 bg-accent/50 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mb-2 px-1">{filtered.length} employees</div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-3">
                  <RefreshCw size={14} className="animate-spin" /> Loading employees…
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="text-sm text-muted-foreground px-2 py-3">No employees found.</div>
              )}
              {filtered.map(r => {
                const name = fullName(r);
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent border border-transparent'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                      {initialsOf(name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name || '—'}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{dash(r.employee_id)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Detail */}
          <div className="space-y-6">
            {!selected ? (
              <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center text-muted-foreground text-sm">
                {loading ? 'Loading…' : 'Select an employee to view their profile.'}
              </div>
            ) : (
              <>
                {/* Header card */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
                    {initialsOf(fullName(selected))}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate">{fullName(selected)}</h2>
                    <p className="text-sm text-muted-foreground">{dash(selected.designation?.name)} · {dash(selected.department?.name)}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{dash(selected.employee_id)}</span>
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{dash(selected.status)}</span>
                    </div>
                  </div>
                </div>

                {/* Sections */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {sections.map((sec, i) => {
                    const Icon = sec.icon;
                    return (
                      <motion.div
                        key={sec.title}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-accent/30">
                          <Icon size={16} className="text-primary" />
                          <h3 className="font-bold text-sm">{sec.title}</h3>
                        </div>
                        <dl className="divide-y divide-border">
                          {sec.rows.map(([label, value]) => (
                            <div key={label} className="grid grid-cols-[40%_60%] gap-2 px-5 py-2.5">
                              <dt className="text-xs text-muted-foreground font-medium">{label}</dt>
                              <dd className="text-sm break-words">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      {showView && selected && <ReportViewModal doc={reportDoc} onClose={() => setShowView(false)} />}
    </div>
  );
}
