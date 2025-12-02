import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import UniversalImage from '../components/UniversalImage';

// Lightweight local BannerCarousel fallback
function BannerCarousel({ banners }) {
  if (!banners) return null;
  const items = Array.isArray(banners) ? banners : Object.entries(banners).map(([id, b]) => ({ id, ...b }));
  if (!items || items.length === 0) return null;

  // filter by optional startDate / endDate (ISO date strings or date-only)
  const now = Date.now();
  const active = items.filter((b) => {
    try {
      if (b.startDate) {
        const s = Date.parse(b.startDate);
        if (!isNaN(s) && now < s) return false;
      }
      if (b.endDate) {
        const e = Date.parse(b.endDate);
        if (!isNaN(e) && now > e) return false;
      }
      return true;
    } catch (e) { return true; }
  });

  if (!active || active.length === 0) return null;

  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  // reset index if active length changes
  React.useEffect(() => { if (idx >= active.length) setIdx(0); }, [active.length, idx]);

  // autoplay every 4s
  React.useEffect(() => {
    if (paused || active.length <= 1) return;
    const tid = setInterval(() => {
      setIdx(i => (i + 1) % active.length);
    }, 4000);
    return () => clearInterval(tid);
  }, [active.length, paused]);

  const prev = () => setIdx(i => (i - 1 + active.length) % active.length);
  const next = () => setIdx(i => (i + 1) % active.length);

  const item = active[idx];

  return (
    <div 
      onMouseEnter={() => setPaused(true)} 
      onMouseLeave={() => setPaused(false)} 
      className="w-full relative group"
    >
      {/* Main Banner Image */}
      <div className="relative overflow-hidden bg-gradient-to-br from-neutral-100 to-neutral-50">
        <UniversalImage
          src={normalizeImageUrl(item.image) || item.image || '/placeholder.jpg'} 
          alt={item.heading || ''} 
          className="w-full h-72 md:h-96 lg:h-[500px] object-cover transition-transform duration-700 group-hover:scale-105" 
        />
        
        {/* Elegant Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
      </div>

      {/* Elegant Content Overlay */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full p-4 sm:p-6 md:p-12 lg:p-16">
          <div className="max-w-3xl">
            {item.heading && (
              <h2 
                className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-2 sm:mb-3 md:mb-4 drop-shadow-2xl"
                style={{ 
                  fontFamily: 'Cormorant Garamond, serif',
                  lineHeight: '1.2',
                  textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                }}
              >
                {item.heading}
              </h2>
            )}
            {item.body && (
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 mb-4 sm:mb-5 md:mb-6 max-w-2xl drop-shadow-lg" style={{ lineHeight: '1.6' }}>
                {item.body}
              </p>
            )}
            {(item.ctaLabel && (item.link || item.ctaLink)) && (
              <a 
                href={item.link || item.ctaLink} 
                className="inline-flex items-center gap-1.5 sm:gap-2 px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 rounded-lg font-semibold text-xs sm:text-sm tracking-wide transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #D4AF37 0%, #f9d77e 100%)',
                  color: '#1a1d20',
                  letterSpacing: '0.8px'
                }}
              >
                {item.ctaLabel}
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Elegant Navigation Controls */}
      {active.length > 1 && (
        <>
          <button 
            onClick={prev} 
            aria-label="Previous" 
            className="absolute left-2 sm:left-4 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30 transition-all duration-300 flex items-center justify-center group-hover:scale-110"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button 
            onClick={next} 
            aria-label="Next" 
            className="absolute right-2 sm:right-4 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/30 transition-all duration-300 flex items-center justify-center group-hover:scale-110"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Elegant Dot Indicators */}
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2">
            {active.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  i === idx 
                    ? 'w-6 sm:w-8 h-1.5 sm:h-2 bg-gradient-to-r from-accent-400 to-accent-500' 
                    : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HomeSection({ title, subtitle, products = [], layout = 'grid', limit = 8 }) {
  const list = (products || []).slice(0, limit);
  if (!list || list.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        {subtitle && <div className="text-sm text-neutral-600">{subtitle}</div>}
      </div>
      <div className={`${layout === 'carousel' ? 'flex gap-4 overflow-x-auto' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6'}`}>
        {list.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { data: productsData } = useFirebaseList("/products");
  const { data: bannersData } = useFirebaseList('/banners');
  const { data: categoriesData } = useFirebaseList('/categories');
  const { data: homeConfig } = useFirebaseList('/homeConfig');
  const { data: homeData } = useFirebaseList('/home');

  useEffect(() => {
    if (categoriesData) {
      const arr = Array.isArray(categoriesData) ? categoriesData : Object.entries(categoriesData).map(([id, v]) => ({ id, ...v }));
      setCategories(arr);
      setLoading(false);
    } else {
      setCategories([]);
      setLoading(false);
    }
  }, [categoriesData]);

  // derive product list
  const productsList = React.useMemo(() => {
    if (!productsData) return [];
    return Object.entries(productsData).map(([id, v]) => ({ id, ...v }));
  }, [productsData]);

  const serverFestivals = React.useMemo(() => {
    const raw = (homeConfig && homeConfig.festivals) ? homeConfig.festivals : {};
    const out = {};
    Object.entries(raw).forEach(([k, v]) => {
      const kk = String(k || '').trim().toLowerCase();
      if (!kk) return;
      if (Array.isArray(v)) out[kk] = v.map(x => String(x).trim().toLowerCase()).filter(Boolean);
      else out[kk] = String(v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    });
    return out;
  }, [homeConfig]);

  // Build festival sections from serverFestivals
  const festivalSections = React.useMemo(() => {
    const sections = [];
    Object.entries(serverFestivals).forEach(([festKey, tags]) => {
      if (!tags || !tags.length) return;
      const prods = productsList.filter(p => {
        if (!p.tags) return false;
        const t = Array.isArray(p.tags) ? p.tags : (String(p.tags).split(',') || []).map(s => s.trim().toLowerCase());
        return t.some(tag => tags.includes(String(tag).toLowerCase()));
      }).slice(0, 8);
      if (prods.length) sections.push({ key: festKey, title: `${festKey.charAt(0).toUpperCase()+festKey.slice(1)} Picks`, products: prods });
    });
    return sections;
  }, [productsList, serverFestivals]);

  const banners = React.useMemo(() => {
    const global = [];

    // 1) banners from /banners path
    if (bannersData) {
      if (Array.isArray(bannersData)) {
        global.push(...bannersData.map((b, i) => ({ id: b.id || `b-${i}`, ...b })));
      } else {
        Object.entries(bannersData).forEach(([id, b]) => global.push({ id, ...b }));
      }
    }

    // 2) carousel images defined in /home.sections.carouselPromo.images (CMS-driven)
    try {
      const promo = homeData && homeData.sections && (homeData.sections.carouselPromo || homeData.sections.carouselpromo || homeData.sections.carousel);
      const imgs = promo && promo.images ? promo.images : (homeData && homeData.carouselPromo ? homeData.carouselPromo.images : null);
      if (Array.isArray(imgs)) {
        imgs.forEach((it, i) => {
          // each item may be a string URL or an object with image/title/buttonText/buttonUrl
          if (!it) return;
          if (typeof it === 'string') {
            global.push({ id: `home-carousel-${i}`, image: it });
          } else {
            global.push({
              id: `home-carousel-${i}`,
              image: it.image || it.imageUrl || it.src || it.url,
              heading: it.title || it.heading,
              body: it.subtitle || it.body,
              ctaLabel: it.buttonText || it.ctaLabel || it.cta || undefined,
              link: it.buttonUrl || it.buttonUrl || it.ctaLink || undefined
            });
          }
        });
      }
    } catch (e) {
      // ignore malformed home data
    }

    return global;
  }, [bannersData, homeData]);

  if (loading) return <Loader />;

  return (
    <main className="min-h-screen">

      {/* Banners / Carousel - Full width on mobile */}
      <section className="max-w-7xl mx-auto px-0 sm:px-4 pt-0 sm:pt-4 md:pt-6">
        <div className="rounded-none sm:rounded-xl md:rounded-2xl overflow-hidden shadow-lg md:shadow-xl border-0 sm:border border-accent-100">
          <BannerCarousel banners={banners} />
        </div>
      </section>

      {/* Elegant Section Divider - Full width on mobile */}
      <div className="max-w-7xl mx-auto px-0 sm:px-4 py-4 sm:py-6 md:py-8">
        <div className="h-px bg-gradient-to-r from-transparent via-accent-200 to-transparent"></div>
      </div>

      {/* Categories Section - Full width on mobile */}
      <section className="max-w-7xl mx-auto px-0 sm:px-4 py-3 sm:py-4 md:py-6">
        {categories && categories.length ? (
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            <div className="text-center px-4 sm:px-0">
              <h2 
                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
                style={{ 
                  fontFamily: 'Cormorant Garamond, serif',
                  color: '#1a1d20',
                  letterSpacing: '0.5px'
                }}
              >
                Shop by Category
              </h2>
              <div className="w-16 sm:w-20 md:w-24 h-0.5 md:h-1 mx-auto bg-gradient-to-r from-accent-400 via-accent-500 to-accent-400 rounded-full"></div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-3 md:gap-4 lg:gap-6 px-1 sm:px-0">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/collections/${col.slug || col.id}`}
                  className="group bg-white rounded-none sm:rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-neutral-100 hover:border-accent-200 transform hover:-translate-y-1"
                  style={{ borderTop: '1px solid rgba(212, 175, 55, 0.2)' }}
                >
                  <div className="relative aspect-square bg-gradient-to-br from-neutral-50 via-white to-neutral-50 overflow-hidden">
                    <UniversalImage
                      src={normalizeImageUrl(col?.image || col?.imageUrl || '/placeholder.jpg')}
                      alt={col?.title || col?.name || col.id}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-1.5 sm:p-2 md:p-3 text-center bg-gradient-to-b from-white to-neutral-50">
                    <div 
                      className="font-semibold text-lg sm:text-base md:text-lg group-hover:text-accent-600 transition-colors duration-300"
                      style={{
                        fontFamily: 'Cormorant Garamond, serif',
                        color: '#1a1d20',
                        letterSpacing: '0.3px'
                      }}
                    >
                      {col?.title || col?.name || col.id}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 sm:py-12 md:py-16">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">�</div>
            <p className="text-neutral-500 font-medium text-sm sm:text-base">No categories available</p>
          </div>
        )}
      </section>

      {/* Festival Sections - Full width horizontal scroll on mobile */}
      <section className="max-w-7xl mx-auto px-0 sm:px-4 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8 md:space-y-12">
        {festivalSections && festivalSections.length > 0 && festivalSections.map(s => (
          <div key={`fest-${s.key}`} className="space-y-3 sm:space-y-4 md:space-y-6">
            <div className="flex items-center justify-between px-4 sm:px-0">
              <div>
                <h3 
                  className="text-xl sm:text-2xl md:text-3xl font-bold mb-0.5 sm:mb-1"
                  style={{ 
                    fontFamily: 'Cormorant Garamond, serif',
                    color: '#1a1d20'
                  }}
                >
                  {s.title}
                </h3>
                <div className="w-12 sm:w-14 md:w-16 h-0.5 bg-gradient-to-r from-accent-500 to-transparent rounded-full"></div>
              </div>
              <Link 
                to={`/collections/${s.key}`}
                className="group flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs md:text-sm font-semibold rounded-md md:rounded-lg transition-all duration-300 hover:bg-accent-50"
                style={{ 
                  color: '#D4AF37',
                  letterSpacing: '0.3px'
                }}
              >
                <span className="hidden sm:inline">Browse All</span>
                <span className="sm:hidden">All</span>
                <svg className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Horizontal Scrollable Product List - Full width on mobile */}
            <div className="relative">
              <div className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory pl-4 sm:pl-0">
                {s.products.map(p => (
                  <div key={p.id} className="flex-shrink-0 w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px] snap-start first:ml-0 last:mr-4 sm:last:mr-0">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              
              {/* Fade effect at the end to indicate more items */}
              <div className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-[#f8f9fa] to-transparent pointer-events-none hidden sm:block"></div>
            </div>
          </div>
        ))}
      </section>

      {/* Bottom Spacing - Reduced on mobile */}
      <div className="h-6 sm:h-8 md:h-12"></div>

    </main>
  );
}
