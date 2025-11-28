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
      // If admin entered offers as multiline text, convert to array before saving
      const payload = { ...form };
      if (payload.offersRaw && typeof payload.offersRaw === 'string') {
        payload.offers = payload.offersRaw.split('\n').map(s => s.trim()).filter(Boolean);
        delete payload.offersRaw;
      }
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
          <label className="block text-sm font-medium mb-1">Brand Name</label>
          <input value={form.brandName||''} onChange={(e)=>setForm({...form, brandName: e.target.value})} className="border p-2 w-full" placeholder="Brand Name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tagline</label>
          <input value={form.tagline||''} onChange={(e)=>setForm({...form, tagline: e.target.value})} className="border p-2 w-full" placeholder="Tagline" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input value={form.logoUrl||''} onChange={(e)=>setForm({...form, logoUrl: e.target.value})} className="border p-2 w-full" placeholder="Logo URL" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">WhatsApp number</label>
          <input value={form.whatsapp||''} onChange={(e)=>setForm({...form, whatsapp: e.target.value})} className="border p-2 w-full" placeholder="WhatsApp number" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Instagram URL</label>
          <input value={form.instagram||''} onChange={(e)=>setForm({...form, instagram: e.target.value})} className="border p-2 w-full" placeholder="Instagram URL" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <input value={form.address||''} onChange={(e)=>setForm({...form, address: e.target.value})} className="border p-2 w-full" placeholder="Address" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Footer text</label>
          <input value={form.footerText||''} onChange={(e)=>setForm({...form, footerText: e.target.value})} className="border p-2 w-full" placeholder="Footer text" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Top banner text</label>
          <textarea value={form.bannerText||''} onChange={(e)=>setForm({...form, bannerText: e.target.value})} className="border p-2 w-full" placeholder="Top banner text (single message)"></textarea>
        </div>

        {/* Theme settings */}
        <div className="col-span-1 md:col-span-2">
          <h3 className="text-sm font-semibold mb-2">Theme / Colors</h3>
          <p className="text-sm text-neutral-600">Theme settings have been moved to a dedicated panel. Manage site colors and backgrounds in <a href="/admin/theme" className="text-blue-600">Admin » Theme</a>.</p>
        </div>

        {/* banner visibility and checkout toggles */}
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.bannerVisible !== false} onChange={(e)=>setForm({...form, bannerVisible: e.target.checked})} /> Show top banner</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.enableWhatsAppCheckout !== false} onChange={(e)=>setForm({...form, enableWhatsAppCheckout: e.target.checked})} /> Enable WhatsApp checkout</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.enableRazorpayCheckout !== false} onChange={(e)=>setForm({...form, enableRazorpayCheckout: e.target.checked})} /> Enable Razorpay checkout</label>

        {/* Minimum order and free shipping settings */}
        <div className="mt-2">
          <label className="block text-sm font-medium mb-1">Minimum purchase amount for checkout (₹)</label>
          <input type="number" min="0" value={form.minPurchaseAmount||''} onChange={(e)=>setForm({...form, minPurchaseAmount: e.target.value})} className="border p-2 w-full" placeholder="e.g. 500" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.freeShippingEnabled !== false} onChange={(e)=>setForm({...form, freeShippingEnabled: e.target.checked})} /> Enable free shipping</label>
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium mb-1">Free shipping threshold (₹)</label>
          <input type="number" min="0" value={form.freeShippingThreshold||''} onChange={(e)=>setForm({...form, freeShippingThreshold: e.target.value})} className="border p-2 w-full" placeholder="e.g. 1000" />
        </div>

        {/* Delivery charge settings */}
        <div className="mt-3">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.deliveryEnabled !== false} onChange={(e)=>setForm({...form, deliveryEnabled: e.target.checked})} /> Enable delivery charges</label>
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium mb-1">Delivery charge amount (₹)</label>
          <input type="number" min="0" value={form.deliveryChargeAmount||''} onChange={(e)=>setForm({...form, deliveryChargeAmount: e.target.value})} className="border p-2 w-full" placeholder="e.g. 50" />
        </div>
        <textarea value={form.offersRaw || (form.offers ? form.offers.join('\n') : '')} onChange={(e)=>setForm({...form, offersRaw: e.target.value})} className="border p-2" placeholder="Offers (one per line)" />
      </div>
      <div className="mt-4">
        <button onClick={onSave} className="btn btn-primary">Save</button>
        {status==='saved' && <span className="ml-3 text-green-600">Saved</span>}
        {status==='error' && <span className="ml-3 text-red-600">Error saving</span>}
      </div>
    </div>
  );
}
