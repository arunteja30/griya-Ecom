import React, { useEffect, useState } from 'react';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function TopBanner(){
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  const [visible, setVisible] = useState(true);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(0);

  // offers: prefer siteSettings.offers (array) or siteSettings.bannerText (string)
  const offers = siteSettings?.offers || null;
  const bannerText = siteSettings?.bannerText || siteSettings?.announcement || '';

  const items = offers && Array.isArray(offers) ? offers : (bannerText ? [bannerText] : [
    '✨ Flat 15% off on selected jewellery — use code GRIYA15',
    '🚚 Free shipping on orders above ₹5,000',
    '💎 Complimentary jewelry cleaning kit with every purchase over ₹10,000'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentOfferIndex((prev) => (prev + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  // If admin disabled banner via site settings, hide
  const bannerVisible = siteSettings?.bannerVisible !== false;
  if(!visible || !items.length || !bannerVisible) return null;

  return (
    <div className="w-full bg-gradient-to-r from-accent-600 to-accent-700 text-white text-sm relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
      <div className="section-container relative">
        <div className="flex items-center justify-between py-3">
          {/* Offer Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="font-semibold text-xs">SPECIAL OFFER</span>
            </div>
          </div>

          {/* Rotating Offers (single item, fade) */}
          <div className="flex-1 flex justify-center px-2">
            <div className="relative w-full max-w-3xl">
              <div key={currentOfferIndex} className="transition-opacity duration-500 opacity-100">
                <div className="py-2 font-medium text-center text-sm leading-snug whitespace-normal">
                  {items[currentOfferIndex]}
                </div>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setVisible(false)} 
              className="text-white/70 hover:text-white transition-colors duration-200 p-1.5 rounded-full hover:bg-white/10"
              aria-label="Close banner"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
