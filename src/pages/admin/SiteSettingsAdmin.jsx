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
    // Prefill pincodes textarea if present
    if (Array.isArray(settings.serviceablePincodes)) pre.serviceablePincodes = settings.serviceablePincodes.join('\n');
    else if (typeof settings.serviceablePincodes === 'string') pre.serviceablePincodes = settings.serviceablePincodes;
    // Prefill storeLocation and radius
    if (settings.storeLocation) {
      pre.storeLat = settings.storeLocation.lat ?? settings.storeLocation.latitude ?? '';
      pre.storeLon = settings.storeLocation.lon ?? settings.storeLocation.longitude ?? '';
    }
    pre.deliveryRadiusKm = settings.deliveryRadiusKm ?? settings.deliveryRadius ?? '';
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
        // geofence settings
        storeLocation: (form.storeLat && form.storeLon) ? { lat: Number(form.storeLat), lon: Number(form.storeLon) } : (settings?.storeLocation || null),
        deliveryRadiusKm: form.deliveryRadiusKm ? Number(form.deliveryRadiusKm) : (settings?.deliveryRadiusKm || null),
        // serviceable pincodes: textarea -> array (one per line) OR keep string if user provided comma separated
        serviceablePincodes: form.serviceablePincodes ? (form.serviceablePincodes.includes('\n') ? form.serviceablePincodes.split('\n').map(s=>s.trim()).filter(Boolean) : form.serviceablePincodes) : settings?.serviceablePincodes || undefined,
        // banner settings
        bannerText: String(form.bannerText || ''),
        bannerLink: String(form.bannerLink || ''),
        bannerVisible: !!form.bannerVisible,
        bannerBgColor: String(form.bannerBgColor || ''),
        bannerTextColor: String(form.bannerTextColor || ''),
        offers: offersArray,
        // Store hours settings
        storeOpenTime: String(form.storeOpenTime || ''),
        storeCloseTime: String(form.storeCloseTime || ''),
        storeOpenDays: Array.isArray(form.storeOpenDays) ? form.storeOpenDays : [],
        storeManuallyOpen: !!form.storeManuallyOpen,
        storeManuallyClosed: !!form.storeManuallyClosed
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
        
        {/* Store Hours Settings */}
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="text-md font-semibold mb-3 text-gray-800">Store Hours</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Store Open Time</label>
              <input 
                type="time" 
                value={form.storeOpenTime||''} 
                onChange={(e)=>setForm({...form, storeOpenTime: e.target.value})} 
                className="border p-2 w-full" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Store Close Time</label>
              <input 
                type="time" 
                value={form.storeCloseTime||''} 
                onChange={(e)=>setForm({...form, storeCloseTime: e.target.value})} 
                className="border p-2 w-full" 
              />
            </div>
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Open Days</label>
            <div className="flex flex-wrap gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                const isSelected = (form.storeOpenDays || []).includes(day);
                return (
                  <label key={day} className="flex items-center gap-1 text-sm">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={(e) => {
                        const currentDays = form.storeOpenDays || [];
                        const newDays = e.target.checked 
                          ? [...currentDays, day]
                          : currentDays.filter(d => d !== day);
                        setForm({...form, storeOpenDays: newDays});
                      }}
                    />
                    {day.slice(0, 3)}
                  </label>
                );
              })}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={!!form.storeManuallyOpen} 
                onChange={(e)=>setForm({...form, storeManuallyOpen: e.target.checked, storeManuallyClosed: false})} 
              />
              Manually Open (Override Hours)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={!!form.storeManuallyClosed} 
                onChange={(e)=>setForm({...form, storeManuallyClosed: e.target.checked, storeManuallyOpen: false})} 
              />
              Manually Closed (Override Hours)
            </label>
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            Manual overrides take precedence over scheduled hours. Use these for holidays or emergency closures.
          </div>
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
          <label className="block text-sm font-medium text-gray-700">Store Location (lat, lon)</label>
          <div className="flex gap-2">
            <input value={form.storeLat||''} onChange={(e)=>setForm({...form, storeLat: e.target.value})} className="border p-2 w-1/2" placeholder="Latitude" />
            <input value={form.storeLon||''} onChange={(e)=>setForm({...form, storeLon: e.target.value})} className="border p-2 w-1/2" placeholder="Longitude" />
          </div>
          <div className="text-xs text-gray-500 mt-1">Optional: used for radius-based delivery checks.</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Delivery radius (km)</label>
          <input value={form.deliveryRadiusKm||''} onChange={(e)=>setForm({...form, deliveryRadiusKm: e.target.value})} className="border p-2" placeholder="Delivery radius in km" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Serviceable pincodes</label>
          <textarea value={form.serviceablePincodes||''} onChange={(e)=>setForm({...form, serviceablePincodes: e.target.value})} className="border p-2 h-24" placeholder="Provide pincodes one-per-line or comma separated (fallback)." />
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
