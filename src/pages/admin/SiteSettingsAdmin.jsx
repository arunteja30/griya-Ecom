import React, { useState, useEffect } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../../firebase';
import { useFirebaseObject } from '../../hooks/useFirebase';
import Loader from '../../components/Loader';

export default function SiteSettingsAdmin() {
  const { data: settings, loading } = useFirebaseObject('/siteSettings');
  const [form, setForm] = useState({});
  const [status, setStatus] = useState(null);

  useEffect(()=>{
    if (!settings) return;
    // Prefill bannerOffers textarea from settings.offers (array -> newline separated string)
    const pre = { ...settings };
    if (Array.isArray(settings.offers)) pre.bannerOffers = settings.offers.join('\n');
    setForm(pre);
  }, [settings]);
  if (loading) return <Loader />;

  const onSave = async () => {
    setStatus('saving');
    try {
      // build offers array from textarea (if provided)
      const offersArray = form.bannerOffers ? form.bannerOffers.split('\n').map(s=>s.trim()).filter(Boolean) : (Array.isArray(settings?.offers) ? settings.offers : (form.bannerText ? [form.bannerText] : []));

      // ensure fee fields are numeric before saving
      const payload = {
        ...form,
        platformFee: Number(form.platformFee) || 0,
        surgeFee: Number(form.surgeFee) || 0,
        otherFee: Number(form.otherFee) || 0,
        deliveryFee: Number(form.deliveryFee) || 0,
        freeDeliveryMin: Number(form.freeDeliveryMin) || 0,
        // banner settings
        bannerText: String(form.bannerText || ''),
        bannerLink: String(form.bannerLink || ''),
        bannerVisible: !!form.bannerVisible,
        bannerBgColor: String(form.bannerBgColor || ''),
        bannerTextColor: String(form.bannerTextColor || ''),
        offers: offersArray
      };
      await set(ref(db, '/siteSettings'), payload);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-3xl bg-white p-6 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Site Settings</h2>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Brand name</label>
          <input value={form.brandName||''} onChange={(e)=>setForm({...form, brandName: e.target.value})} className="border p-2" placeholder="Brand Name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Tagline</label>
          <input value={form.tagline||''} onChange={(e)=>setForm({...form, tagline: e.target.value})} className="border p-2" placeholder="Tagline" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Logo URL</label>
          <input value={form.logoUrl||''} onChange={(e)=>setForm({...form, logoUrl: e.target.value})} className="border p-2" placeholder="Logo URL" />
        </div>
        {/* Top banner settings */}
        <div className="grid grid-cols-1 gap-2">
          <label className="text-sm">Top banner message</label>
          <input value={form.bannerText||''} onChange={(e)=>setForm({...form, bannerText: e.target.value})} className="border p-2" placeholder="Banner message text (fallback)" />

          <label className="text-sm">Banner offers (one per line)</label>
          <textarea value={form.bannerOffers||''} onChange={(e)=>setForm({...form, bannerOffers: e.target.value})} className="border p-2 h-24" placeholder="Enter multiple offers, one per line. These take precedence over Banner message." />

          <div className="flex gap-2">
            <input value={form.bannerLink||''} onChange={(e)=>setForm({...form, bannerLink: e.target.value})} className="border p-2 flex-1" placeholder="Banner link (optional)" />
            <input value={form.bannerBgColor||''} onChange={(e)=>setForm({...form, bannerBgColor: e.target.value})} className="border p-2 w-40" placeholder="Banner bg hex (e.g. #df2121) or Tailwind class" />
          </div>

          <div className="flex gap-2 items-center">
            <label className="text-sm">Banner text color / class</label>
            <input value={form.bannerTextColor||''} onChange={(e)=>setForm({...form, bannerTextColor: e.target.value})} className="border p-2 w-40" placeholder="e.g. text-white or #000" />
          </div>

          <div className="text-xs text-neutral-500">You can provide a hex color like <code>#df2121</code> or a Tailwind class like <code>bg-orange-500</code>.</div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.bannerVisible} onChange={(e)=>setForm({...form, bannerVisible: e.target.checked})} />
            Show top banner
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">WhatsApp number</label>
          <input value={form.whatsapp||''} onChange={(e)=>setForm({...form, whatsapp: e.target.value})} className="border p-2" placeholder="WhatsApp number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Instagram URL</label>
          <input value={form.instagram||''} onChange={(e)=>setForm({...form, instagram: e.target.value})} className="border p-2" placeholder="Instagram URL" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <input value={form.address||''} onChange={(e)=>setForm({...form, address: e.target.value})} className="border p-2" placeholder="Address" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Footer text</label>
          <input value={form.footerText||''} onChange={(e)=>setForm({...form, footerText: e.target.value})} className="border p-2" placeholder="Footer text" />
        </div>

        {/* Fees (flat INR amounts) */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Platform fee (₹)</label>
            <input value={form.platformFee ?? ''} onChange={(e)=>setForm({...form, platformFee: e.target.value})} className="border p-2" placeholder="Platform fee (₹)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Surge fee (₹)</label>
            <input value={form.surgeFee ?? ''} onChange={(e)=>setForm({...form, surgeFee: e.target.value})} className="border p-2" placeholder="Surge fee (₹)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Other fee (₹)</label>
            <input value={form.otherFee ?? ''} onChange={(e)=>setForm({...form, otherFee: e.target.value})} className="border p-2" placeholder="Other fee (₹)" />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">Delivery fee (₹)</label>
          <input value={form.deliveryFee ?? ''} onChange={(e)=>setForm({...form, deliveryFee: e.target.value})} className="border p-2 w-full" placeholder="Delivery fee (₹)" />
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">Free delivery minimum (₹)</label>
          <input value={form.freeDeliveryMin ?? ''} onChange={(e)=>setForm({...form, freeDeliveryMin: e.target.value})} className="border p-2 w-full" placeholder="Free delivery minimum (₹)" />
        </div>
      </div>
      <div className="mt-4">
        <button onClick={onSave} className="bg-black text-white px-4 py-2 rounded">Save</button>
        {status==='saved' && <span className="ml-3 text-green-600">Saved</span>}
        {status==='error' && <span className="ml-3 text-red-600">Error saving</span>}
      </div>
    </div>
  );
}
