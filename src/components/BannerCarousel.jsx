import React, { useEffect, useMemo, useState, useRef } from 'react';

export default function BannerCarousel({ banners = [] }) {
  if (!banners || !banners.length) return null;

  // show whatever the server returned; if server returns an object map convert to array
  const visible = useMemo(() => {
    if (!banners) return [];
    if (Array.isArray(banners)) return banners;
    // fallback: convert keyed object to array while preserving id
    return Object.entries(banners).map(([id, b]) => ({ id, ...b }));
  }, [banners]);
  if (!visible.length) return null;

  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // reset index if banners change
    setIndex(0);
  }, [visible.length]);

  useEffect(() => {
    const start = () => {
      stop();
      intervalRef.current = setInterval(() => {
        setIndex(i => (i + 1) % visible.length);
      }, 4000);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    start();
    return () => stop();
  }, [visible.length]);

  const goPrev = (e) => { e && e.preventDefault(); setIndex(i => (i - 1 + visible.length) % visible.length); };
  const goNext = (e) => { e && e.preventDefault(); setIndex(i => (i + 1) % visible.length); };

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="relative overflow-hidden rounded-lg">
        <div ref={containerRef} className="relative h-56 sm:h-72 lg:h-80">
          {visible.map((b, i) => {
            const href = b.ctaLink || '#';
            const isExternal = typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'));
            const isActive = i === index;
            return (
              <a
                key={`banner-slide-${i}`}
                href={href}
                target={isExternal ? '_blank' : '_self'}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className={`absolute inset-0 block transition-opacity duration-700 ease-in-out ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
              >
                <div className="w-full h-full bg-gray-100">
                  <img src={b.image} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute left-6 bottom-6 text-white max-w-lg">
                    {b.title && <div className="text-2xl font-bold">{b.title}</div>}
                    {b.subtitle && <div className="text-sm opacity-90 mt-1">{b.subtitle}</div>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Controls */}
        <button aria-label="Previous banner" onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/60 z-40 pointer-events-auto">‹</button>
        <button aria-label="Next banner" onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/60 z-40 pointer-events-auto">›</button>

        {/* Indicators */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-2 z-40 pointer-events-auto">
          {visible.map((_, i) => (
            <button key={`banner-ind-${i}`} onClick={() => setIndex(i)} className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
