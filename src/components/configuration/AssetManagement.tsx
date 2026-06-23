import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../supabase/client';
import {
  Boxes, ChevronLeft, Plus, Pencil, Trash2, X, UserPlus, Undo2, Search, Tag, RefreshCw, Laptop,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import { toast } from 'react-toastify';
import {
  loadAssetCategories, loadAssets, upsertAsset, deleteAsset, allocateAsset, returnAsset,
  upsertAssetCategory, deleteAssetCategory, ASSET_STATUSES,
  type Asset, type AssetCategory, type AssetStatus, type AssetInput,
} from '../../lib/assets';

const adb = supabase as unknown as SupabaseClient;
const inputCls = 'w-full p-2.5 bg-accent/50 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20';
const selectCls = inputCls + ' appearance-none';
const STATUS_STYLE: Record<AssetStatus, string> = {
  Available: 'bg-green-100 text-green-700 border-green-200',
  Allocated: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Maintenance': 'bg-amber-100 text-amber-700 border-amber-200',
  Retired: 'bg-gray-100 text-gray-600 border-gray-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
};
interface EmpOpt { id: string; code: string; name: string }

export default function AssetManagement({ onBack }: { onBack?: () => void }) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [assetModal, setAssetModal] = useState<AssetInput | null>(null);
  const [allocFor, setAllocFor] = useState<Asset | null>(null);
  const [allocEmp, setAllocEmp] = useState('');
  const [catModal, setCatModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [cats, ast] = await Promise.all([loadAssetCategories(), loadAssets()]);
    setCategories(cats); setAssets(ast); setLoading(false);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    void (async () => {
      const { data } = await adb.from('employees').select('id, employee_id, first_name, middle_name, last_name').order('first_name');
      setEmployees(((data ?? []) as Array<Record<string, any>>).map(e => ({ id: e.id, code: e.employee_id ?? '', name: [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ') || (e.employee_id ?? '') })));
    })();
  }, []);

  const filtered = useMemo(() => assets
    .filter(a => activeCat === 'all' || a.categoryId === activeCat)
    .filter(a => !search || a.productId.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()) || a.serialNumber.toLowerCase().includes(search.toLowerCase()) || a.allocatedToName.toLowerCase().includes(search.toLowerCase())),
    [assets, activeCat, search]);

  const counts = useMemo(() => ({ total: assets.length, allocated: assets.filter(a => a.status === 'Allocated').length, available: assets.filter(a => a.status === 'Available').length }), [assets]);

  const newAsset = () => setAssetModal({ productId: '', categoryId: activeCat !== 'all' ? activeCat : (categories[0]?.id ?? ''), name: '', status: 'Available' });
  const editAsset = (a: Asset) => setAssetModal({ id: a.id, productId: a.productId, categoryId: a.categoryId, name: a.name, makeModel: a.makeModel, serialNumber: a.serialNumber, status: a.status, condition: a.condition, purchaseDate: a.purchaseDate, purchaseCost: a.purchaseCost, mobileNumber: a.mobileNumber, remarks: a.remarks });

  const saveAsset = async () => {
    if (!assetModal) return;
    if (!assetModal.productId.trim() || !assetModal.name.trim() || !assetModal.categoryId) { toast.error('Product ID, Category and Name are required.'); return; }
    setBusy(true);
    const { error } = await upsertAsset(assetModal);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(assetModal.id ? 'Asset updated.' : 'Asset added.');
    setAssetModal(null); await reload();
  };
  const removeAsset = async (a: Asset) => {
    if (a.allocatedTo) { toast.error('Hand over the asset before deleting it.'); return; }
    const { error } = await deleteAsset(a.id);
    if (error) { toast.error(error); return; }
    toast.info('Asset deleted.'); await reload();
  };
  const doAllocate = async () => {
    if (!allocFor || !allocEmp) { toast.error('Select an employee.'); return; }
    setBusy(true);
    const { error } = await allocateAsset(allocFor.id, allocEmp);
    setBusy(false);
    if (error) { toast.error(error); return; }
    toast.success(`${allocFor.name} allocated.`);
    setAllocFor(null); setAllocEmp(''); await reload();
  };
  const doReturn = async (a: Asset) => {
    const { error } = await returnAsset(a.id);
    if (error) { toast.error(error); return; }
    toast.success(`${a.name} handed over / returned.`); await reload();
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBack && <button onClick={onBack} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><ChevronLeft size={20} /></button>}
              <div className="p-2 bg-cyan-100 rounded-lg"><Boxes size={22} className="text-cyan-600" /></div>
              <div>
                <h1 className="text-xl font-bold font-serif">Asset Management</h1>
                <p className="text-xs text-muted-foreground">Company assets stored category-wise with a Product ID, allocated to employees.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCatModal(true)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent text-sm font-medium"><Tag size={15} /> Categories</button>
              <button onClick={newAsset} className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 shadow-sm text-sm font-medium"><Plus size={16} /> Add Asset</button>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            {[{ l: 'Total Assets', v: counts.total, c: 'bg-cyan-100 text-cyan-700' }, { l: 'Allocated', v: counts.allocated, c: 'bg-blue-100 text-blue-700' }, { l: 'Available', v: counts.available, c: 'bg-green-100 text-green-700' }].map(s => (
              <div key={s.l} className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${s.c}`}><Laptop size={18} /></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">{s.l}</p><p className="font-bold text-lg">{s.v}</p></div>
              </div>
            ))}
          </div>

          {/* Category tabs + search */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveCat('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${activeCat === 'all' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-accent text-muted-foreground border-border'}`}>All ({assets.length})</button>
            {categories.map(c => {
              const n = assets.filter(a => a.categoryId === c.id).length;
              return <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${activeCat === c.id ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-accent text-muted-foreground border-border'}`}>{c.name} ({n})</button>;
            })}
            <div className="relative ml-auto min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Product ID, name, holder…" className="w-full pl-9 pr-3 py-2 bg-accent/50 border border-border rounded-lg text-sm outline-none" />
            </div>
          </div>

          {/* Asset table */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-accent/50 text-muted-foreground text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Product ID</th>
                    <th className="px-4 py-2.5 font-semibold">Asset</th>
                    <th className="px-4 py-2.5 font-semibold">Category</th>
                    <th className="px-4 py-2.5 font-semibold">Serial / Mobile</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Allocated To</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><RefreshCw size={15} className="inline animate-spin mr-2" />Loading…</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No assets. Click <strong>Add Asset</strong> to register one.</td></tr>}
                  {!loading && filtered.map(a => (
                    <tr key={a.id} className="hover:bg-accent/30">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{a.productId}</td>
                      <td className="px-4 py-2.5"><p className="font-medium">{a.name}</p>{a.makeModel && <p className="text-[10px] text-muted-foreground">{a.makeModel}</p>}</td>
                      <td className="px-4 py-2.5 text-xs">{a.categoryName}</td>
                      <td className="px-4 py-2.5 text-xs font-mono">{a.serialNumber || a.mobileNumber || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[a.status]}`}>{a.status}</span></td>
                      <td className="px-4 py-2.5 text-xs">{a.allocatedTo ? <><span className="font-medium">{a.allocatedToName}</span><span className="text-muted-foreground"> · {a.allocatedToCode}</span></> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {a.allocatedTo
                            ? <button onClick={() => doReturn(a)} title="Hand over / Return" className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600"><Undo2 size={15} /></button>
                            : <button onClick={() => { setAllocFor(a); setAllocEmp(''); }} title="Allocate" disabled={a.status !== 'Available'} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 disabled:opacity-30"><UserPlus size={15} /></button>}
                          <button onClick={() => editAsset(a)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                          <button onClick={() => removeAsset(a)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Asset add/edit modal */}
      <AnimatePresence>
        {assetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30">
                <h2 className="text-lg font-bold">{assetModal.id ? 'Edit Asset' : 'Add Asset'}</h2>
                <button onClick={() => setAssetModal(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Product ID *</label><input className={`${inputCls} font-mono`} placeholder="e.g. LAP-0001" value={assetModal.productId} onChange={e => setAssetModal(m => m && ({ ...m, productId: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Category *</label><select className={selectCls} value={assetModal.categoryId} onChange={e => setAssetModal(m => m && ({ ...m, categoryId: e.target.value }))}><option value="">— Select —</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Asset Name *</label><input className={inputCls} placeholder="e.g. Dell Latitude 5440" value={assetModal.name} onChange={e => setAssetModal(m => m && ({ ...m, name: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Make / Model</label><input className={inputCls} value={assetModal.makeModel ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, makeModel: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Serial Number</label><input className={`${inputCls} font-mono`} value={assetModal.serialNumber ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, serialNumber: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Mobile No. (Data Card / Phone)</label><input className={`${inputCls} font-mono`} value={assetModal.mobileNumber ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, mobileNumber: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Condition</label><input className={inputCls} placeholder="e.g. New / Good / Fair" value={assetModal.condition ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, condition: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Purchase Date</label><input type="date" className={inputCls} value={assetModal.purchaseDate ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, purchaseDate: e.target.value }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Purchase Cost (₹)</label><input type="number" className={inputCls} value={assetModal.purchaseCost ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, purchaseCost: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Status</label><select className={selectCls} value={assetModal.status ?? 'Available'} onChange={e => setAssetModal(m => m && ({ ...m, status: e.target.value as AssetStatus }))}>{ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Remarks</label><input className={inputCls} value={assetModal.remarks ?? ''} onChange={e => setAssetModal(m => m && ({ ...m, remarks: e.target.value }))} /></div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setAssetModal(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
                <button onClick={saveAsset} disabled={busy} className="px-6 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-60">{busy ? 'Saving…' : assetModal.id ? 'Save Changes' : 'Add Asset'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Allocate modal */}
      <AnimatePresence>
        {allocFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30"><h2 className="text-lg font-bold">Allocate Asset</h2><button onClick={() => setAllocFor(null)} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button></div>
              <div className="p-6 space-y-4">
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-sm"><p className="font-semibold">{allocFor.name}</p><p className="text-xs text-muted-foreground font-mono">{allocFor.productId} · {allocFor.categoryName}</p></div>
                <div><label className="block text-xs font-bold mb-1.5 text-muted-foreground uppercase">Allocate To Employee</label>
                  <select className={selectCls} value={allocEmp} onChange={e => setAllocEmp(e.target.value)}><option value="">— Select employee —</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-accent/10">
                <button onClick={() => setAllocFor(null)} className="px-5 py-2 text-sm font-medium text-muted-foreground">Cancel</button>
                <button onClick={doAllocate} disabled={busy} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"><UserPlus size={15} /> Allocate</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category management modal */}
      <AnimatePresence>
        {catModal && <CategoryModal categories={categories} onClose={() => { setCatModal(false); void reload(); }} />}
      </AnimatePresence>
    </div>
  );
}

function CategoryModal({ categories, onClose }: { categories: AssetCategory[]; onClose: () => void }) {
  const [list, setList] = useState(categories);
  const [name, setName] = useState(''); const [code, setCode] = useState('');
  const refresh = async () => setList(await loadAssetCategories());
  const add = async () => { if (!name.trim()) return; const { error } = await upsertAssetCategory({ name: name.trim(), code: code.trim() }); if (error) { toast.error(error); return; } setName(''); setCode(''); await refresh(); toast.success('Category added.'); };
  const del = async (id: string) => { const { error } = await deleteAssetCategory(id); if (error) { toast.error(error); return; } await refresh(); toast.info('Category deleted.'); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-accent/30"><h2 className="text-lg font-bold">Asset Categories</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"><X size={20} /></button></div>
        <div className="p-6 space-y-3">
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Category name" value={name} onChange={e => setName(e.target.value)} />
            <input className={`${inputCls} w-24 font-mono`} placeholder="Code" value={code} onChange={e => setCode(e.target.value)} />
            <button onClick={add} className="px-4 bg-cyan-600 text-white rounded-lg text-sm font-medium shrink-0">Add</button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            {list.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{c.name} <span className="text-[10px] text-muted-foreground font-mono">{c.code}</span></span>
                <button onClick={() => del(c.id)} className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
