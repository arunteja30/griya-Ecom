import React, { useState, useEffect } from 'react';
import { ref, push, set, update, remove } from 'firebase/database';
import { db } from '../../firebase';
import { useFirebaseList } from '../../hooks/useFirebase';
import Loader from '../../components/Loader';

export default function PromoAdmin() {
  const { data: promosRaw, loading } = useFirebaseList('/promoCodes');
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ code: '', type: 'percent', amount: 0, active: true, maxUses: 0 });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!promosRaw) return setPromos([]);
    if (Array.isArray(promosRaw)) setPromos(promosRaw.map((p, idx) => ({ ...p, _key: idx })));
    else setPromos(Object.entries(promosRaw).map(([k, v]) => ({ ...v, _key: k })));
  }, [promosRaw]);

  const resetForm = () => setForm({ code: '', type: 'percent', amount: 0, active: true, maxUses: 0 });

  if (loading) return <Loader />;

  const save = async () => {
    setStatus('saving');
    try {
      if (form._key) {
        await set(ref(db, `/promoCodes/${form._key}`), { ...form, used: form.used || 0 });
      } else {
        const p = { ...form, used: 0 };
        await push(ref(db, '/promoCodes'), p);
      }
      setStatus('saved');
      resetForm();
    } catch (e) {
      setStatus('error');
    }
  };

  const edit = (p) => setForm({ ...p, _key: p._key });
  const del = async (p) => { if (!confirm('Delete promo?')) return; await remove(ref(db, `/promoCodes/${p._key}`)); };

  return (
    <div className="max-w-3xl bg-white p-6 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Promo Codes</h2>
      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input value={form.code||''} onChange={(e)=>setForm({...form, code: e.target.value})} className="border p-2 w-full" placeholder="Code" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select value={form.type||'percent'} onChange={(e)=>setForm({...form, type: e.target.value})} className="border p-2 w-full">
            <option value="percent">Percent</option>
            <option value="fixed">Fixed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input type="number" value={form.amount||0} onChange={(e)=>setForm({...form, amount: Number(e.target.value)})} className="border p-2 w-full" placeholder="Amount" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Max uses (0 = unlimited)</label>
          <input type="number" value={form.maxUses||0} onChange={(e)=>setForm({...form, maxUses: Number(e.target.value)})} className="border p-2 w-full" placeholder="Max uses (0 = unlimited)" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active!==false} onChange={(e)=>setForm({...form, active: e.target.checked})} /> Active</label>
          <div className="text-sm text-neutral-600">Used: {form.used || 0}</div>
        </div>
        <div className="mt-4">
          <button onClick={save} className="btn btn-primary">Save</button>
          <button onClick={resetForm} className="px-3 py-2">Reset</button>
          {status==='saved' && <span className="ml-3 text-green-600">Saved</span>}
          {status==='error' && <span className="ml-3 text-red-600">Error</span>}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Existing Codes</h3>
        <div className="space-y-2">
          {promos.map((p) => (
            <div key={p._key} className="p-3 border rounded flex items-center justify-between">
              <div>
                <div className="font-semibold">{p.code} {p.active===false && <span className="text-sm text-red-600">(inactive)</span>}</div>
                <div className="text-sm text-neutral-600">{p.type} - {p.amount} | Used: {p.used||0} | Max: {p.maxUses||'∞'}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>edit(p)} className="px-2 py-1 border">Edit</button>
                <button onClick={()=>del(p)} className="px-2 py-1 border text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
