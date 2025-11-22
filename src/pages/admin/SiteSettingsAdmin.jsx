import React, { useState, useEffect } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../../firebase';
import { useFirebaseObject } from '../../hooks/useFirebase';
import Loader from '../../components/Loader';

export default function SiteSettingsAdmin() {
  const { data: settings, loading } = useFirebaseObject('/siteSettings');
  const [form, setForm] = useState({});
  const [status, setStatus] = useState(null);

  useEffect(()=>{ if (settings) setForm(settings); }, [settings]);
  if (loading) return <Loader />;

  const onSave = async () => {
    setStatus('saving');
    try {
      await set(ref(db, '/siteSettings'), form);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl bg-white p-6 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Site Settings</h2>
      <div className="grid grid-cols-1 gap-3">
        <input value={form.brandName||''} onChange={(e)=>setForm({...form, brandName: e.target.value})} className="border p-2" placeholder="Brand Name" />
        <input value={form.tagline||''} onChange={(e)=>setForm({...form, tagline: e.target.value})} className="border p-2" placeholder="Tagline" />
        <input value={form.logoUrl||''} onChange={(e)=>setForm({...form, logoUrl: e.target.value})} className="border p-2" placeholder="Logo URL" />
        <input value={form.whatsapp||''} onChange={(e)=>setForm({...form, whatsapp: e.target.value})} className="border p-2" placeholder="WhatsApp number" />
        <input value={form.instagram||''} onChange={(e)=>setForm({...form, instagram: e.target.value})} className="border p-2" placeholder="Instagram URL" />
        <input value={form.address||''} onChange={(e)=>setForm({...form, address: e.target.value})} className="border p-2" placeholder="Address" />
        <input value={form.footerText||''} onChange={(e)=>setForm({...form, footerText: e.target.value})} className="border p-2" placeholder="Footer text" />
      </div>
      <div className="mt-4">
        <button onClick={onSave} className="bg-black text-white px-4 py-2 rounded">Save</button>
        {status==='saved' && <span className="ml-3 text-green-600">Saved</span>}
        {status==='error' && <span className="ml-3 text-red-600">Error saving</span>}
      </div>
    </div>
  );
}
