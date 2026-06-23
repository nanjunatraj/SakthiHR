// Asset Management — company assets stored category-wise with a Product ID, allocated
// to employees, with allocation history for handover tracking on relieving.
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

const db = supabase as unknown as SupabaseClient;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v) || 0);

export type AssetStatus = 'Available' | 'Allocated' | 'In Maintenance' | 'Retired' | 'Lost';
export const ASSET_STATUSES: AssetStatus[] = ['Available', 'Allocated', 'In Maintenance', 'Retired', 'Lost'];

export interface AssetCategory { id: string; name: string; code: string; description: string; status: string }
export interface Asset {
  id: string; productId: string; categoryId: string; categoryName: string; name: string;
  makeModel: string; serialNumber: string; status: AssetStatus; condition: string;
  purchaseDate: string; purchaseCost: number; mobileNumber: string;
  allocatedTo: string | null; allocatedToName: string; allocatedToCode: string; allocatedOn: string; remarks: string;
}

const empName = (e: Record<string, any> | null) => e ? ([e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? '')) : '';

function rowToAsset(r: Record<string, any>): Asset {
  return {
    id: r.id, productId: r.product_id ?? '', categoryId: r.category_id ?? '',
    categoryName: r.category?.name ?? '—', name: r.name ?? '', makeModel: r.make_model ?? '',
    serialNumber: r.serial_number ?? '', status: (r.status as AssetStatus) ?? 'Available',
    condition: r.condition ?? '', purchaseDate: r.purchase_date ?? '', purchaseCost: num(r.purchase_cost),
    mobileNumber: r.mobile_number ?? '', allocatedTo: r.allocated_to ?? null,
    allocatedToName: empName(r.allocated_employee ?? null), allocatedToCode: r.allocated_employee?.employee_id ?? '',
    allocatedOn: r.allocated_on ?? '', remarks: r.remarks ?? '',
  };
}

const ASSET_SELECT = 'id, product_id, category_id, name, make_model, serial_number, status, condition, purchase_date, purchase_cost, mobile_number, allocated_to, allocated_on, remarks, category:asset_categories(name), allocated_employee:employees!assets_allocated_to_fkey(employee_id, first_name, middle_name, last_name)';

export async function loadAssetCategories(): Promise<AssetCategory[]> {
  const { data } = await db.from('asset_categories').select('id, name, code, description, status').order('name');
  return ((data ?? []) as Array<Record<string, any>>).map(r => ({ id: r.id, name: r.name ?? '', code: r.code ?? '', description: r.description ?? '', status: r.status ?? 'Active' }));
}
export async function upsertAssetCategory(c: { id?: string; name: string; code: string; description?: string }): Promise<{ error: string | null }> {
  const row = { name: c.name, code: c.code || null, description: c.description || null };
  const { error } = c.id ? await db.from('asset_categories').update(row).eq('id', c.id) : await db.from('asset_categories').insert(row as never);
  return { error: error?.message ?? null };
}
export async function deleteAssetCategory(id: string): Promise<{ error: string | null }> {
  const { error } = await db.from('asset_categories').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function loadAssets(): Promise<Asset[]> {
  const { data } = await db.from('assets').select(ASSET_SELECT).order('created_at', { ascending: false });
  return ((data ?? []) as Array<Record<string, any>>).map(rowToAsset);
}

export interface AssetInput {
  id?: string; productId: string; categoryId: string; name: string; makeModel?: string; serialNumber?: string;
  status?: AssetStatus; condition?: string; purchaseDate?: string; purchaseCost?: number; mobileNumber?: string; remarks?: string;
}
export async function upsertAsset(a: AssetInput): Promise<{ error: string | null }> {
  const row: Record<string, unknown> = {
    product_id: a.productId, category_id: a.categoryId || null, name: a.name, make_model: a.makeModel || null,
    serial_number: a.serialNumber || null, condition: a.condition || null,
    purchase_date: a.purchaseDate || null, purchase_cost: a.purchaseCost ?? null, mobile_number: a.mobileNumber || null,
    remarks: a.remarks || null, updated_at: new Date().toISOString(),
  };
  if (a.status) row.status = a.status;
  const { error } = a.id ? await db.from('assets').update(row).eq('id', a.id) : await db.from('assets').insert({ ...row, status: a.status || 'Available' } as never);
  return { error: error?.message ?? null };
}
export async function deleteAsset(id: string): Promise<{ error: string | null }> {
  const { error } = await db.from('assets').delete().eq('id', id);
  return { error: error?.message ?? null };
}

/** Allocate an asset to an employee (status → Allocated) + write a history row. */
export async function allocateAsset(assetId: string, employeeId: string, remarks?: string): Promise<{ error: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db.from('assets').update({ allocated_to: employeeId, allocated_on: today, status: 'Allocated', updated_at: new Date().toISOString() } as never).eq('id', assetId);
  if (error) return { error: error.message };
  await db.from('asset_allocations').insert({ asset_id: assetId, employee_id: employeeId, action: 'Allocated', on_date: today, remarks: remarks || null } as never);
  return { error: null };
}

/** Return / hand over an asset (status → Available, clear holder) + history row. */
export async function returnAsset(assetId: string, remarks?: string): Promise<{ error: string | null }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: cur } = await db.from('assets').select('allocated_to').eq('id', assetId).maybeSingle();
  const prevEmp = (cur as { allocated_to: string | null } | null)?.allocated_to ?? null;
  const { error } = await db.from('assets').update({ allocated_to: null, allocated_on: null, status: 'Available', updated_at: new Date().toISOString() } as never).eq('id', assetId);
  if (error) return { error: error.message };
  await db.from('asset_allocations').insert({ asset_id: assetId, employee_id: prevEmp, action: 'Returned', on_date: today, remarks: remarks || null } as never);
  return { error: null };
}

/** Assets currently under an employee's charge (for the Employee Master Assets tab). */
export async function loadEmployeeAssets(employeeId: string): Promise<Asset[]> {
  if (!employeeId) return [];
  const { data } = await db.from('assets').select(ASSET_SELECT).eq('allocated_to', employeeId).order('allocated_on', { ascending: false });
  return ((data ?? []) as Array<Record<string, any>>).map(rowToAsset);
}

/** React hook: employee's allocated assets, with a refetch trigger. */
export function useEmployeeAssets(employeeId: string | undefined): { assets: Asset[]; reload: () => void } {
  const [assets, setAssets] = useState<Asset[]>([]);
  const reload = useCallback(() => { if (employeeId) void loadEmployeeAssets(employeeId).then(setAssets); else setAssets([]); }, [employeeId]);
  useEffect(() => { reload(); }, [reload]);
  return { assets, reload };
}
