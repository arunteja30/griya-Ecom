import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";

// Lightweight local BannerCarousel fallback
function BannerCarousel({ banners }) {
  if (!banners || banners.length === 0) return null;
  const items = Array.isArray(banners) ? banners : Object.entries(banners).map(([id,b])=>({ id, ...b }));
  const first = items[0];
  return (
    <div className="w-full rounded overflow-hidden">
      {first && (
        <a href={first.ctaLink || first.link || '#'} className="block">
          <img src={normalizeImageUrl(first.image) || '/placeholder.jpg'} alt={first.title || ''} className="w-full h-48 object-cover" />
        </a>
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
      <section>
        <BannerCarousel banners={banners} />
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-4">
        {categories && categories.length ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/collections/${col.slug || col.id}`}
                  className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
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

      {/* Festival Sections (server configured) */}
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        {festivalSections && festivalSections.length > 0 && festivalSections.map(s => (
          <HomeSection key={`fest-${s.key}`} title={s.title} subtitle="Festive essentials" products={s.products} layout="grid" limit={8} />
        ))}
      </section>

    </main>
  );
}
