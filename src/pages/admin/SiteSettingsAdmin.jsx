import React, { useState, useEffect } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../../firebase';
import { useFirebaseObject } from '../../hooks/useFirebase';
import Loader from '../../components/Loader';
import AdminCard from './AdminCard';

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
    <AdminCard title="Site Settings" subtitle="Configure global site and store settings">
      <div className="space-y-8">
        
        {/* Brand & Basic Info Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Brand Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name</label>
              <input 
                value={form.brandName||''} 
                onChange={(e)=>setForm({...form, brandName: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                placeholder="Enter your brand name" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
              <input 
                value={form.tagline||''} 
                onChange={(e)=>setForm({...form, tagline: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                placeholder="A catchy tagline for your brand" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
              <input 
                value={form.logoUrl||''} 
                onChange={(e)=>setForm({...form, logoUrl: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                placeholder="https://example.com/logo.png" 
              />
              <p className="text-xs text-gray-500 mt-1">Direct URL to your brand logo image</p>
            </div>
          </div>
        </div>

        {/* Store Hours Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Store Operating Hours</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opening Time</label>
                  <input 
                    type="time" 
                    value={form.storeOpenTime||''} 
                    onChange={(e)=>setForm({...form, storeOpenTime: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Closing Time</label>
                  <input 
                    type="time" 
                    value={form.storeCloseTime||''} 
                    onChange={(e)=>setForm({...form, storeCloseTime: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Operating Days</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                    const isSelected = (form.storeOpenDays || []).includes(day);
                    return (
                      <label key={day} className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-green-200 bg-green-50 text-green-800' 
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}>
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
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm font-medium">{day.slice(0, 3)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-yellow-800 mb-3">Manual Overrides</h4>
                <div className="space-y-3">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.storeManuallyOpen 
                      ? 'border-yellow-300 bg-yellow-100' 
                      : 'border-yellow-200 bg-white'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={!!form.storeManuallyOpen} 
                      onChange={(e)=>setForm({...form, storeManuallyOpen: e.target.checked, storeManuallyClosed: false})} 
                      className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-yellow-900">Force Open</div>
                      <div className="text-xs text-yellow-700">Override scheduled hours to stay open</div>
                    </div>
                  </label>
                  
                  <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    form.storeManuallyClosed 
                      ? 'border-red-300 bg-red-100' 
                      : 'border-red-200 bg-white'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={!!form.storeManuallyClosed} 
                      onChange={(e)=>setForm({...form, storeManuallyClosed: e.target.checked, storeManuallyOpen: false})} 
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-red-900">Force Closed</div>
                      <div className="text-xs text-red-700">Override scheduled hours to close store</div>
                    </div>
                  </label>
                </div>
                
                <div className="text-xs text-gray-600 mt-3 p-2 bg-white rounded border border-gray-200">
                  💡 Use manual overrides for holidays or emergency closures. They take precedence over scheduled hours.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banner Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Top Banner Configuration</h3>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={!!form.bannerVisible} 
                  onChange={(e)=>setForm({...form, bannerVisible: e.target.checked})} 
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-purple-900">Show Top Banner</span>
              </label>
              <div className="text-xs text-purple-700">Enable the promotional banner at the top of your site</div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banner Message (Fallback)</label>
                  <input 
                    value={form.bannerText||''} 
                    onChange={(e)=>setForm({...form, bannerText: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                    placeholder="Single banner message" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banner Offers (Priority)</label>
                  <textarea 
                    value={form.bannerOffers||''} 
                    onChange={(e)=>setForm({...form, bannerOffers: e.target.value})} 
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-colors h-24" 
                    placeholder="Enter multiple offers, one per line&#10;Free shipping on orders above ₹500&#10;Buy 2 Get 1 Free on selected items"
                  />
                  <p className="text-xs text-gray-500 mt-1">Multiple offers (one per line) take precedence over the banner message</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banner Link (Optional)</label>
                  <input 
                    value={form.bannerLink||''} 
                    onChange={(e)=>setForm({...form, bannerLink: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                    placeholder="/products or https://external-link.com" 
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Background Color</label>
                  <input 
                    value={form.bannerBgColor||''} 
                    onChange={(e)=>setForm({...form, bannerBgColor: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                    placeholder="#ff6b6b or bg-red-500" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                  <input 
                    value={form.bannerTextColor||''} 
                    onChange={(e)=>setForm({...form, bannerTextColor: e.target.value})} 
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors" 
                    placeholder="#ffffff or text-white" 
                  />
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Color Format Options</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Hex colors: <code className="bg-white px-1 rounded">#ff6b6b</code>, <code className="bg-white px-1 rounded">#ffffff</code></li>
                    <li>• Tailwind classes: <code className="bg-white px-1 rounded">bg-red-500</code>, <code className="bg-white px-1 rounded">text-white</code></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact & Social Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Contact & Social Media</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number</label>
              <input 
                value={form.whatsapp||''} 
                onChange={(e)=>setForm({...form, whatsapp: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
                placeholder="+91 9876543210" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Instagram Profile</label>
              <input 
                value={form.instagram||''} 
                onChange={(e)=>setForm({...form, instagram: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
                placeholder="https://instagram.com/yourbrand" 
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Address</label>
              <textarea 
                value={form.address||''} 
                onChange={(e)=>setForm({...form, address: e.target.value})} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none transition-colors" 
                rows={2}
                placeholder="123 Business Street, City, State, PIN Code" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default City</label>
              <input 
                value={form.defaultCity||''} 
                onChange={(e)=>setForm({...form, defaultCity: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
                placeholder="Enter default city name" 
              />
              <p className="text-xs text-gray-500 mt-1">This will be auto-filled in customer checkout forms</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Default Pincode</label>
              <input 
                value={form.defaultPincode||''} 
                onChange={(e)=>setForm({...form, defaultPincode: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
                placeholder="Enter default pincode" 
              />
              <p className="text-xs text-gray-500 mt-1">This will be auto-filled in customer checkout forms</p>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Footer Text</label>
              <input 
                value={form.footerText||''} 
                onChange={(e)=>setForm({...form, footerText: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors" 
                placeholder="© 2024 Your Brand Name. All rights reserved." 
              />
            </div>
          </div>
        </div>
        {/* Location & Delivery Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-teal-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Location & Delivery Configuration</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store Location</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input 
                      type="number" 
                      step="any" 
                      value={form.storeLat||''} 
                      onChange={(e)=>setForm({...form, storeLat: e.target.value})} 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" 
                      placeholder="Latitude (e.g., 28.6139)" 
                    />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="number" 
                      step="any" 
                      value={form.storeLon||''} 
                      onChange={(e)=>setForm({...form, storeLon: e.target.value})} 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" 
                      placeholder="Longitude (e.g., 77.2090)" 
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Used for distance-based delivery calculations</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Radius (km)</label>
                <input 
                  type="number" 
                  value={form.deliveryRadiusKm||''} 
                  onChange={(e)=>setForm({...form, deliveryRadiusKm: e.target.value})} 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors" 
                  placeholder="e.g., 10" 
                />
                <p className="text-xs text-gray-500 mt-1">Maximum delivery distance from store location</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serviceable Pincodes</label>
                <textarea 
                  value={form.serviceablePincodes||''} 
                  onChange={(e)=>setForm({...form, serviceablePincodes: e.target.value})} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none transition-colors h-24" 
                  placeholder="110001, 110002, 110003&#10;Enter one pincode per line&#10;or comma-separated values" 
                />
                <p className="text-xs text-gray-500 mt-1">Specific pincodes where delivery is available (fallback)</p>
              </div>
              
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-teal-800 mb-2">🗺️ Location Configuration Help</h4>
                <div className="text-xs text-teal-700 space-y-1">
                  <p>• Use <a href="https://www.google.com/maps" target="_blank" className="text-teal-600 hover:underline">Google Maps</a> to find exact coordinates</p>
                  <p>• Right-click on your store location to get lat/lng</p>
                  <p>• Delivery radius is checked if pincodes are not provided</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fees & Pricing Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900">Fees & Pricing Structure</h3>
          </div>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-blue-900">Platform Fee</h4>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-blue-700 mr-2">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.platformFee ?? ''} 
                    onChange={(e)=>setForm({...form, platformFee: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors" 
                    placeholder="0.00" 
                  />
                </div>
                <p className="text-xs text-blue-700 mt-1">Fixed fee charged per order</p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <h4 className="text-sm font-semibold text-green-900">Surge Fee</h4>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-green-700 mr-2">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.surgeFee ?? ''} 
                    onChange={(e)=>setForm({...form, surgeFee: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white transition-colors" 
                    placeholder="0.00" 
                  />
                </div>
                <p className="text-xs text-green-700 mt-1">Additional fee during peak hours</p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-purple-900">Other Fee</h4>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-purple-700 mr-2">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.otherFee ?? ''} 
                    onChange={(e)=>setForm({...form, otherFee: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white transition-colors" 
                    placeholder="0.00" 
                  />
                </div>
                <p className="text-xs text-purple-700 mt-1">Miscellaneous charges</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-1" />
                  </svg>
                  <h4 className="text-sm font-semibold text-yellow-900">Delivery Fee</h4>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-yellow-700 mr-2">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.deliveryFee ?? ''} 
                    onChange={(e)=>setForm({...form, deliveryFee: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white transition-colors" 
                    placeholder="0.00" 
                  />
                </div>
                <p className="text-xs text-yellow-700 mt-1">Standard delivery charge</p>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <svg className="w-4 h-4 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <h4 className="text-sm font-semibold text-emerald-900">Free Delivery Minimum</h4>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-emerald-700 mr-2">₹</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={form.freeDeliveryMin ?? ''} 
                    onChange={(e)=>setForm({...form, freeDeliveryMin: e.target.value})} 
                    className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-colors" 
                    placeholder="0.00" 
                  />
                </div>
                <p className="text-xs text-emerald-700 mt-1">Minimum order value for free delivery</p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">💰 Fee Structure Guidelines</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Platform Fee: Covers app maintenance and transaction processing</p>
                <p>• Surge Fee: Applied during high-demand periods or bad weather</p>
                <p>• Delivery Fee: Standard shipping charge (waived when order ≥ minimum amount)</p>
                <p>• Other Fee: Additional charges like packaging or handling fees</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button 
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 font-medium"
          >
            Reset Changes
          </button>
          <button 
            type="button"
            onClick={onSave}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Settings
            {status==='saved' && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Saved</span>}
            {status==='error' && <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Error</span>}
          </button>
        </div>
      </div>
    </AdminCard>
  );
}
