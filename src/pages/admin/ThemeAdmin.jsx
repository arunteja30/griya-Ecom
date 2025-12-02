import React, { useEffect, useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../../firebase';
import { useFirebaseObject } from '../../hooks/useFirebase';
import Loader from '../../components/Loader';
import UniversalImage from '../../components/UniversalImage';
import { showToast } from '../../components/Toast';

export default function ThemeAdmin(){
  const { data: settings, loading } = useFirebaseObject('/siteSettings');
  const [theme, setTheme] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    if (!settings) return;
    const t = settings.theme || {
      primary: settings.primaryColor || '#2874F0',
      accent: settings.accentColor || '#FFCC00',
      navBg: settings.navBg || '',
      footerBg: settings.footerBg || '',
      buttonBg: settings.buttonBg || '',
      siteBg: settings.siteBg || ''
    };
    setTheme(t);
  }, [settings]);

  if (loading) return <Loader />;

  const save = async () => {
    setSaving(true);
    try{
      await set(ref(db, '/siteSettings/theme'), theme || {});
      showToast('Theme saved');
    }catch(e){
      console.error('Failed to save theme', e);
      showToast('Failed to save theme', 'error');
    }finally{ setSaving(false); }
  };

  // Compute preview values from current theme (used in live preview)
  const pc = theme.productCard || {};
  const cardBg = pc.cardBg || '#ffffff';
  const nameColor = pc.name || '#0b2a66';
  const priceColor = pc.price || '#0b2a66';
  const starColor = pc.star || '#F59E0B';
  const badgeNew = pc.badgeNew || '#10B981';
  const badgeBest = pc.badgeBestseller || '#F59E0B';
  const badgeDisc = pc.badgeDiscount || '#DC2626';
  const btnBg = theme.buttonBg || theme.primary || '#2874F0';
  const parseHexContrast = (bg) => {
    if (!bg || !bg.startsWith('#')) return '#fff';
    let hex = bg.replace('#','');
    if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    const bright = (r*299 + g*587 + b*114)/1000;
    return bright > 128 ? '#111' : '#fff';
  };
  const btnText = parseHexContrast(btnBg);

  return (
    <div className="max-w-3xl md:max-w-5xl bg-white p-6 rounded shadow">
      <h2 className="text-lg font-semibold mb-4">Theme Settings</h2>
      {/* make two columns on medium+ screens: left = controls, right = preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Primary color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={theme.primary||'#2874F0'} onChange={(e)=>setTheme(t=>({...t, primary: e.target.value}))} className="w-12 h-10 p-0 border" />
                <input value={theme.primary||''} onChange={(e)=>setTheme(t=>({...t, primary: e.target.value}))} className="border p-2 flex-1" placeholder="#2874F0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Accent color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={theme.accent||'#FFCC00'} onChange={(e)=>setTheme(t=>({...t, accent: e.target.value}))} className="w-12 h-10 p-0 border" />
                <input value={theme.accent||''} onChange={(e)=>setTheme(t=>({...t, accent: e.target.value}))} className="border p-2 flex-1" placeholder="#FFCC00" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nav background</label>
              <div className="flex items-center gap-2">
                <input type="color" value={theme.navBg||'#ffffff'} onChange={(e)=>setTheme(t=>({...t, navBg: e.target.value}))} className="w-12 h-10 p-0 border" />
                <input value={theme.navBg||''} onChange={(e)=>setTheme(t=>({...t, navBg: e.target.value}))} className="border p-2 flex-1" placeholder="#ffffff or rgba(...)" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Footer background</label>
              <div className="flex items-center gap-2">
                <input type="color" value={theme.footerBg||'#0b2a66'} onChange={(e)=>setTheme(t=>({...t, footerBg: e.target.value}))} className="w-12 h-10 p-0 border" />
                <input value={theme.footerBg||''} onChange={(e)=>setTheme(t=>({...t, footerBg: e.target.value}))} className="border p-2 flex-1" placeholder="#0b2a66" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Button background</label>
              <div className="flex items-center gap-2">
                <input type="color" value={theme.buttonBg||theme.primary||'#2874F0'} onChange={(e)=>setTheme(t=>({...t, buttonBg: e.target.value}))} className="w-12 h-10 p-0 border" />
                <input value={theme.buttonBg||''} onChange={(e)=>setTheme(t=>({...t, buttonBg: e.target.value}))} className="border p-2 flex-1" placeholder="#2874F0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Site background</label>
              <input value={theme.siteBg||''} onChange={(e)=>setTheme(t=>({...t, siteBg: e.target.value}))} className="border p-2 w-full" placeholder="CSS background value or hex"></input>
            </div>
          </div>

          {/* Product card specific colors */}
          <div className="pt-4">
            <h3 className="text-sm font-semibold mb-2">Product card</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Card background</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.cardBg) || '#ffffff'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), cardBg: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.cardBg) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), cardBg: e.target.value}}))} className="border p-2 flex-1" placeholder="#ffffff or rgba(...)" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Product name color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.name) || '#0b2a66'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), name: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.name) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), name: e.target.value}}))} className="border p-2 flex-1" placeholder="#0b2a66" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Price color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.price) || '#0b2a66'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), price: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.price) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), price: e.target.value}}))} className="border p-2 flex-1" placeholder="#0b2a66" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Review star color</label>
                <input type="color" value={(theme.productCard && theme.productCard.star) || '#F59E0B'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), star: e.target.value}}))} className="w-12 h-10 p-0 border" />
                <input value={(theme.productCard && theme.productCard.star) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), star: e.target.value}}))} className="border p-2 mt-2 w-full" placeholder="#F59E0B"></input>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Badge: New</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.badgeNew) || '#10B981'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeNew: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.badgeNew) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeNew: e.target.value}}))} className="border p-2 flex-1" placeholder="#10B981" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Badge: Bestseller</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.badgeBestseller) || '#F59E0B'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeBestseller: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.badgeBestseller) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeBestseller: e.target.value}}))} className="border p-2 flex-1" placeholder="#F59E0B" />
                </div>
              </div>

              <div>
                <label className="block text-sm font medium mb-1">Badge: Discount</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={(theme.productCard && theme.productCard.badgeDiscount) || '#DC2626'} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeDiscount: e.target.value}}))} className="w-12 h-10 p-0 border" />
                  <input value={(theme.productCard && theme.productCard.badgeDiscount) || ''} onChange={(e)=>setTheme(t=>({...t, productCard: {...(t.productCard||{}), badgeDiscount: e.target.value}}))} className="border p-2 flex-1" placeholder="#DC2626" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save Theme'}</button>
            <a href="/" target="_blank" rel="noreferrer" className="ml-3 text-sm text-neutral-500">Open site to preview</a>
          </div>
        </div>

        {/* Right column: live preview of a product card */}
        <div className="hidden md:block">
          <h3 className="text-sm font-semibold mb-3">Product card preview</h3>
          <div className="p-3">
            <div className="rounded-2xl shadow-md overflow-hidden" style={{ background: cardBg, width: 320 }}>
              <div style={{ height: 140, background: '#f3f4f6' }} className="w-full overflow-hidden">
                <UniversalImage src={'/placeholder.jpg'} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: badgeNew, color: '#fff', fontSize: 11, fontWeight: 700 }}>New</div>
                    <div style={{ padding: '4px 8px', borderRadius: 999, background: badgeBest, color: '#fff', fontSize: 11, fontWeight: 700 }}>Bestseller</div>
                  </div>
                  <div style={{ padding: '4px 8px', borderRadius: 8, background: badgeDisc, color: '#fff', fontSize: 11, fontWeight: 700 }}>-15%</div>
                </div>

                <h4 className="font-semibold text-sm mb-1" style={{ color: nameColor }}>Elegant Silver Chain</h4>
                <div className="flex items-center gap-2 mb-3">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{ color: starColor }}>
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.974a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.974c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.387 2.46c-.785.57-1.84-.197-1.54-1.118l1.287-3.974a1 1 0 00-.364-1.118L2.609 9.4c-.783-.57-.38-1.81.588-1.81h4.18a1 1 0 00.95-.69L9.05 2.927z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-xs text-neutral-500">(24)</div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold" style={{ color: priceColor }}>₹3,499</div>
                    <div className="text-sm text-neutral-500 line-through">₹4,199</div>
                  </div>
                  <button className="px-4 py-2 rounded-md text-sm font-medium" style={{ background: btnBg, color: btnText }}>Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
