import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, set } from 'firebase/database';
import { showToast } from '../../components/Toast';
import ProductCard from '../../components/ProductCard';
import { useFirebaseObject } from '../../hooks/useFirebase';

export default function ThemeAdmin(){
  const { data: settings, loading } = useFirebaseObject('/siteSettings');
  const initial = settings?.theme || {};

  const defaults = {
    primaryColor: '#111827',
    accentColor: '#fb923c',
    appBackground: '#f8fafc',
    cardBgColor: '#ffffff',
    productCardBgColor: '#ffffff',
    cardTextColor: '#111827',
    cardBorderColor: '#e5e7eb',
    cardButtonPrimaryBg: '#111827',
    cardButtonAccentBg: '#fb923c',
    cardBadgeBgColor: '#16a34a',
    cardButtonPrimaryTextColor: '#ffffff',
    cardButtonAccentTextColor: '#ffffff',
    titleColor: '#111827',
    tagTextColor: '#ffffff',
    footerBgColor: '#111827',
    footerTextColor: '#ffffff',
    navBgColor: '',
    navItemTextColor: '#111827',
    navTextColor: '#111827',
  };

  const [theme, setTheme] = useState({ ...defaults, ...initial });

  useEffect(()=>{
    if(initial) setTheme(prev => ({ ...prev, ...initial }));
  }, [initial]);

  const handleChange = (key, value) => setTheme(t => ({ ...t, [key]: value }));

  const saveTheme = async () => {
    try{
      await set(ref(db, '/siteSettings/theme'), theme);
      showToast('Theme saved');
    }catch(e){
      console.error(e);
      showToast('Failed to save theme', 'error');
    }
  };

  const resetDefaults = () => setTheme({ ...defaults });

  // sample product used for live ProductCard preview
  const sampleProduct = {
    id: 'sample-1',
    slug: 'sample-product',
    name: 'Sample Product',
    images: [ '/placeholder.jpg' ],
    price: 199,
    originalPrice: 249,
    discount: 20,
    inStock: true,
    description: 'This is a preview product used to show theme colors on the product card.',
    unit: '500 g',
  };

  if(loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Theme settings</h2>
      <p className="text-sm text-neutral-600 mb-4">Enter raw hex color values. Changes are saved to <code>/siteSettings/theme</code> and will apply after saving.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600">Primary color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.primaryColor} onChange={e=>handleChange('primaryColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.primaryColor} onChange={e=>handleChange('primaryColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Accent color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.accentColor} onChange={e=>handleChange('accentColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.accentColor} onChange={e=>handleChange('accentColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">App background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.appBackground} onChange={e=>handleChange('appBackground', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.appBackground} onChange={e=>handleChange('appBackground', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardBgColor} onChange={e=>handleChange('cardBgColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardBgColor} onChange={e=>handleChange('cardBgColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardTextColor} onChange={e=>handleChange('cardTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardTextColor} onChange={e=>handleChange('cardTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card border color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardBorderColor} onChange={e=>handleChange('cardBorderColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardBorderColor} onChange={e=>handleChange('cardBorderColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card primary button background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardButtonPrimaryBg} onChange={e=>handleChange('cardButtonPrimaryBg', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardButtonPrimaryBg} onChange={e=>handleChange('cardButtonPrimaryBg', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card primary button text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardButtonPrimaryTextColor} onChange={e=>handleChange('cardButtonPrimaryTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardButtonPrimaryTextColor} onChange={e=>handleChange('cardButtonPrimaryTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

          <div>
          <label className="block text-xs text-gray-600">Product Card background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.productCardBgColor} onChange={e=>handleChange('productCardBgColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.productCardBgColor} onChange={e=>handleChange('productCardBgColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card accent button background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardButtonAccentBg} onChange={e=>handleChange('cardButtonAccentBg', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardButtonAccentBg} onChange={e=>handleChange('cardButtonAccentBg', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card accent button text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardButtonAccentTextColor} onChange={e=>handleChange('cardButtonAccentTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardButtonAccentTextColor} onChange={e=>handleChange('cardButtonAccentTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Site title color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.titleColor} onChange={e=>handleChange('titleColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.titleColor} onChange={e=>handleChange('titleColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Card badge background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.cardBadgeBgColor} onChange={e=>handleChange('cardBadgeBgColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.cardBadgeBgColor} onChange={e=>handleChange('cardBadgeBgColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Tag text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.tagTextColor} onChange={e=>handleChange('tagTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.tagTextColor} onChange={e=>handleChange('tagTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Nav items text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.navItemTextColor} onChange={e=>handleChange('navItemTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.navItemTextColor} onChange={e=>handleChange('navItemTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Footer background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.footerBgColor} onChange={e=>handleChange('footerBgColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.footerBgColor} onChange={e=>handleChange('footerBgColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Footer text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.footerTextColor} onChange={e=>handleChange('footerTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.footerTextColor} onChange={e=>handleChange('footerTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Nav background</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.navBgColor || '#000000'} onChange={e=>handleChange('navBgColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.navBgColor || ''} onChange={e=>handleChange('navBgColor', e.target.value)} placeholder="#000000 or empty for transparent" className="border p-2 rounded w-full" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600">Nav text color</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={theme.navTextColor} onChange={e=>handleChange('navTextColor', e.target.value)} className="w-12 h-8 p-0 border rounded" />
            <input value={theme.navTextColor} onChange={e=>handleChange('navTextColor', e.target.value)} className="border p-2 rounded w-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={saveTheme} className="px-4 py-2 rounded bg-primary-600 text-white">Save</button>
        <button onClick={resetDefaults} className="px-4 py-2 rounded border">Reset</button>
      </div>

      <div className="mt-6">
        <div className="font-semibold mb-2">Preview (live)</div>

        <div className="max-w-3xl mx-auto space-y-3">
          {/* Nav preview */}
          <div className="rounded-t-lg px-4 py-3" style={{ background: theme.navBgColor || 'transparent' }}>
            <div className="flex items-center justify-between" style={{ color: theme.navTextColor || undefined }}>
              <div className="font-bold">{settings?.brandName || 'Store'}</div>
              <div className="flex items-center gap-2">
                {/* sample nav items to demonstrate nav item color */}
                <div style={{ color: theme.navItemTextColor, fontSize: 13, marginRight: 12 }}>Home</div>
                <div style={{ color: theme.navItemTextColor, fontSize: 13, marginRight: 12 }}>Groceries</div>
                <div style={{ color: theme.navItemTextColor, fontSize: 13 }}>Contact</div>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.accentColor }} />
                <div style={{ width: 24, height: 24, borderRadius: 6, background: theme.primaryColor }} />
              </div>
            </div>
          </div>

          {/* Card preview */}
          <div className="p-4 rounded shadow-sm" style={{ background: theme.cardBgColor, color: theme.cardTextColor, border: `1px solid ${theme.cardBorderColor || 'transparent'}` }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{settings?.brandName || 'Store'}</div>
            <div className="text-sm mb-3" style={{ color: theme.cardTextColor }}>{settings?.tagline || 'Product card preview'}</div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">Sample product</div>
                <div className="text-sm" style={{ color: theme.cardTextColor }}>{theme.primaryColor} · {theme.accentColor}</div>
                <div className="inline-block mt-2 text-xs px-2 py-1 rounded" style={{ background: theme.cardBadgeBgColor, color: theme.tagTextColor }}>Tag</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded" style={{ background: theme.cardButtonPrimaryBg || theme.primaryColor, color: theme.cardButtonPrimaryTextColor || '#ffffff' }}>Primary</button>
                <button className="px-3 py-1 rounded" style={{ background: theme.cardButtonAccentBg || theme.accentColor, color: theme.cardButtonAccentTextColor || '#ffffff' }}>Accent</button>
              </div>
            </div>

            {/* Live ProductCard preview */}
            <div className="mt-4">
              <div className="font-semibold mb-2">Live product card</div>
              <div style={{ width: 220 }}>
                <ProductCard product={sampleProduct} />
              </div>
            </div>
          </div>

          {/* Footer preview */}
          <div className="rounded-b-lg px-4 py-3 text-sm" style={{ background: theme.footerBgColor || undefined, color: theme.footerTextColor || undefined }}>
            <div className="text-center">{settings?.footerText || 'Footer preview — copyright'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
