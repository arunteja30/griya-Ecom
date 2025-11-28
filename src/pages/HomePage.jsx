import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";

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
  React.useEffect(() => { if (idx >= active.length) setIdx(0); }, [active.length]);

  // autoplay every 5s
  React.useEffect(() => {
    if (paused || active.length <= 1) return;
    const tid = setInterval(() => {
      setIdx(i => (i + 1) % active.length);
    }, 5000);
    return () => clearInterval(tid);
  }, [active.length, paused]);

  const prev = () => setIdx(i => (i - 1 + active.length) % active.length);
  const next = () => setIdx(i => (i + 1) % active.length);

  const item = active[idx];

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="w-full rounded overflow-hidden relative">
      <a href={item.ctaLink || item.link || '#'} className="block">
        <img src={normalizeImageUrl(item.image) || item.image || '/placeholder.jpg'} alt={item.heading || ''} className="w-full h-64 md:h-96 object-cover" />
      </a>

      {/* overlay content */}
      <div className="absolute inset-0 flex items-end">
        <div className="w-full bg-gradient-to-t from-black/60 to-transparent p-6 md:p-12">
          <div className="max-w-2xl text-white">
            {item.heading && <h2 className="text-2xl md:text-4xl font-bold">{item.heading}</h2>}
            {item.body && <p className="mt-2 text-sm md:text-base">{item.body}</p>}
            {(item.ctaLabel && (item.link || item.ctaLink)) && (
              <a href={item.link || item.ctaLink} className="inline-block mt-4 px-4 py-2 bg-orange-600 text-white rounded">{item.ctaLabel}</a>
            )}
          </div>
        </div>
      </div>

      {/* controls */}
      <button onClick={prev} aria-label="Previous" className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white rounded-full p-2">
        ‹
      </button>
      <button onClick={next} aria-label="Next" className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/30 text-white rounded-full p-2">
        ›
      </button>
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
    if (bannersData) {
      if (Array.isArray(bannersData)) {
        global.push(...bannersData.map((b, i) => ({ id: b.id || `b-${i}`, ...b })));
      } else {
        Object.entries(bannersData).forEach(([id, b]) => global.push({ id, ...b }));
      }
    }
    return global;
  }, [bannersData]);

  if (loading) return <Loader />;

  return (
    <main className="space-y-8 pb-8">

      {/* Banners / Carousel */}
      <section className="max-w-7xl mx-auto px-4 mb-3 md:mb-0">
        <BannerCarousel banners={banners} />
      </section>

      {/* Categories Section - horizontal scrolling */}
      <section className="max-w-7xl mx-auto px-4">
        {categories && categories.length ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>

            {/* horizontal scroll container */}
            <div className="flex gap-4 overflow-x-auto py-3">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/collections/${col.slug || col.id}`}
                  className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 w-40 flex-shrink-0"
                >
                  <div className="relative aspect-square bg-gradient-to-br from-orange-50 to-orange-100">
                    <img
                      src={normalizeImageUrl(col?.image || col?.imageUrl || '/placeholder.jpg')}
                      alt={col?.title || col?.name || col.id}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                  <div className="p-3 text-center">
                    <div className="font-medium text-gray-800 text-sm group-hover:text-orange-600 transition-colors">
                      {col?.title || col?.name || col.id}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🛒</div>
            <p className="text-gray-600">No categories available</p>
          </div>
        )}
      </section>

      {/* Festival Sections (server configured) - horizontal product carousels */}
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        {festivalSections && festivalSections.length > 0 && festivalSections.map(s => (
          <section key={`fest-${s.key}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{s.title}</h3>
              <Link to={`/collections/${s.key}`} className="text-sm border-b border-fill border-accent-600">Browse all</Link>
            </div>

            {/* horizontal product list */}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {s.products.map(p => (
                <div key={p.id} className="w-64 flex-shrink-0">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </section>

    </main>
  );
}
