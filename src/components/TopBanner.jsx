import React, { useEffect, useState } from 'react';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function TopBanner() {
  const { data: siteSettings } = useFirebaseObject('/siteSettings');
  const initialVisible = siteSettings?.bannerVisible !== undefined ? !!siteSettings.bannerVisible : true;
  const [visible, setVisible] = useState(initialVisible);
  const [index, setIndex] = useState(0);

  const text = siteSettings?.bannerText || '';
  const offers = Array.isArray(siteSettings?.offers) ? siteSettings.offers : (text ? [text] : []);

  const bgRaw = (siteSettings?.bannerBgColor || '').toString();
  const isHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(bgRaw.trim());
  const bgClass = !isHex && bgRaw ? bgRaw : 'bg-accent-600';
  const textClass = siteSettings?.bannerTextColor || 'text-white';
  const link = siteSettings?.bannerLink || '';

  useEffect(() => {
    if (!offers || offers.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % offers.length), 3500);
    return () => clearInterval(t);
  }, [offers]);

  useEffect(() => {
    if (siteSettings && siteSettings.bannerVisible !== undefined) setVisible(!!siteSettings.bannerVisible);
  }, [siteSettings]);

  if (!visible || !offers || offers.length === 0) return null;

  const inner = (
    <div className={`section-container relative ${textClass}`}>
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-white/20">
            <span className="text-xs font-semibold">OFFER</span>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="h-6 overflow-hidden relative">
            <div className="transition-transform duration-500" style={{ transform: `translateY(-${index * 24}px)` }}>
              {offers.map((o, i) => (
                <div key={i} className="h-6 flex items-center justify-center px-4">
                  {o}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <button onClick={() => setVisible(false)} className="p-1.5 rounded-full text-white/80 hover:bg-white/10" aria-label="Close banner">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  const style = isHex ? { backgroundColor: bgRaw } : undefined;
  const cls = isHex ? '' : bgClass;

  return (
    <div className={`${cls} relative overflow-hidden text-sm`} style={style}>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
