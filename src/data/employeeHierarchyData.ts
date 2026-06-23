// ─── Shared Employee Data for Hierarchy, Directory, and Search ────────────────
//
// Sourced LIVE from the Supabase `employees` table (joined to the master tables
// for designation / department / work location / type / grade names). No mock
// data — these views show only the employees that have actually been saved.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;

export interface HierarchyEmployee {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  workLocation: string;
  employeeType: string;
  employeeGrade: string;
  avatar: string;
  email: string;
  phone: string;
  doj: string;
  reportingManagerId: string | null;
  status: 'Active' | 'Inactive' | 'On Leave';
  skills: string[];
  hierarchyComplete: boolean;
}

// Live list, kept in sync by useHierarchyEmployees() so the pure helpers below
// (which take no list argument) can read the current set.
let _employees: HierarchyEmployee[] = [];

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

function rowToHierarchyEmployee(r: Record<string, any>): HierarchyEmployee {
  const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' ');
  const status: HierarchyEmployee['status'] =
    r.status === 'Inactive' || r.status === 'On Leave' ? r.status : 'Active';
  return {
    id: r.id,
    employeeCode: r.employee_id ?? '',
    name,
    designation: r.designation?.name ?? '',
    department: r.department?.name ?? '',
    workLocation: r.work_location?.name ?? '',
    employeeType: r.employee_type?.name ?? '',
    employeeGrade: r.grade?.name ?? '',
    avatar: initialsOf(name),
    email: '',
    phone: '',
    doj: r.date_of_joining ?? '',
    reportingManagerId: r.reporting_manager_id ?? null,
    status,
    skills: [],
    // "Complete" = positioned under a reporting manager in the org tree.
    hierarchyComplete: Boolean(r.reporting_manager_id),
  };
}

const EMPLOYEE_SELECT =
  'id, employee_id, first_name, middle_name, last_name, date_of_joining, reporting_manager_id, status, ' +
  'designation:designations(name), department:departments(name), work_location:work_locations(name), ' +
  'employee_type:employee_types(name), grade:employee_grades(name)';

/** Live (DB-backed) list of saved employees, mapped to the hierarchy shape. */
export function useHierarchyEmployees(): HierarchyEmployee[] {
  const [rows, setRows] = useState<HierarchyEmployee[]>(_employees);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await db.from('employees').select(EMPLOYEE_SELECT).order('first_name');
      if (error) { console.warn('[employees] load failed:', error.message); return; }
      const list = (data ?? []).map(rowToHierarchyEmployee);
      _employees = list;
      if (active) setRows(list);
    })();
    return () => { active = false; };
  }, []);
  return rows;
}

/** Distinct, sorted facet values across the loaded employees (for filter dropdowns). */
export function facetsOf(list: HierarchyEmployee[]) {
  const uniq = (vals: string[]) => [...new Set(vals.filter(Boolean))].sort();
  return {
    departments: uniq(list.map(e => e.department)),
    locations: uniq(list.map(e => e.workLocation)),
    designations: uniq(list.map(e => e.designation)),
    employeeTypes: uniq(list.map(e => e.employeeType)),
  };
}

// ─── Org-tree helpers (operate on the currently-loaded employee set) ───────────

export function getReportingManager(employeeId: string): HierarchyEmployee | null {
  const emp = _employees.find(e => e.id === employeeId);
  if (!emp || !emp.reportingManagerId) return null;
  return _employees.find(e => e.id === emp.reportingManagerId) ?? null;
}

export function getDirectReports(managerId: string): HierarchyEmployee[] {
  return _employees.filter(e => e.reportingManagerId === managerId);
}

export function getAllReports(managerId: string): HierarchyEmployee[] {
  const direct = getDirectReports(managerId);
  const all: HierarchyEmployee[] = [...direct];
  direct.forEach(emp => { all.push(...getAllReports(emp.id)); });
  return all;
}

export function buildHierarchyTree(parentId: string | null): HierarchyEmployee[] {
  return _employees.filter(e => e.reportingManagerId === parentId);
}

export function getHierarchyDepth(employeeId: string, depth = 0): number {
  const emp = _employees.find(e => e.id === employeeId);
  if (!emp || !emp.reportingManagerId) return depth;
  return getHierarchyDepth(emp.reportingManagerId, depth + 1);
}

export function getHierarchyPath(employeeId: string): HierarchyEmployee[] {
  const path: HierarchyEmployee[] = [];
  let current = _employees.find(e => e.id === employeeId);
  while (current) {
    path.unshift(current);
    if (!current.reportingManagerId) break;
    current = _employees.find(e => e.id === current!.reportingManagerId);
  }
  return path;
}
