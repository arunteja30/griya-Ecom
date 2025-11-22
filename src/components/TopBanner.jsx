import React, { useEffect, useState } from 'react';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function TopBanner(){
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  const [visible, setVisible] = useState(true);

  // offers: prefer siteSettings.offers (array) or siteSettings.bannerText (string)
  const offers = siteSettings?.offers || null;
  const bannerText = siteSettings?.bannerText || siteSettings?.announcement || '';

  useEffect(()=>{
    // auto-hide after a long time optionally (disabled by default)
  },[]);

  if(!visible) return null;

  const items = offers && Array.isArray(offers) ? offers : (bannerText ? [bannerText] : [
    'Flat 10% off on selected jewellery — use code GRIYA10',
    'Free shipping on orders above ₹5,000',
    'Complimentary jewelry cleaning kit with every purchase over ₹10,000'
  ]);

  // simple marquee: duplicate items to create continuous scroll
  const marqueeText = items.join('  •  ');

  return (
    <div className="w-full bg-gradient-to-r from-yellow-50 to-yellow-100 border-b border-yellow-200 text-sm text-yellow-900">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="inline-block bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">Offers</span>
          <div className="hidden sm:block text-xs text-yellow-900">{items[0]}</div>
        </div>

        <div className="flex-1 mx-6 overflow-hidden">
          <div className="whitespace-nowrap animate-marquee">
            <span className="pr-8">{marqueeText}</span>
            <span className="pr-8">{marqueeText}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={()=>setVisible(false)} className="text-yellow-900/80 hover:text-yellow-900 px-2">Close</button>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          will-change: transform;
          animation: marquee 18s linear infinite;
        }
      `}</style>
    </div>
  );
}
