import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import { getCategories } from "../firebaseApi";

import RecommendationsSection from "../components/RecommendationsSection";
import HomeSection from "../components/HomeSection";
import BannerCarousel from "../components/BannerCarousel";
import { useCart } from '../context/CartContext';

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: productsData } = useFirebaseList("/products");
  const { data: bannersData } = useFirebaseList('/banners');
  // read server-configured recommendation maps (optional)
  const { data: homeConfig } = useFirebaseList('/homeConfig');
  const { cartItems } = useCart();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(data || []);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Failed to load categories', err);
        setError(err.message || 'Failed to load categories');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // derive product lists from realtime products data
  const productsList = React.useMemo(() => {
    if (!productsData) return [];
    return Object.entries(productsData).map(([id, v]) => ({ id, ...v }));
  }, [productsData]);

  const timeOfDay = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 11) return 'morning';
    if (h < 16) return 'afternoon';
    return 'evening';
  }, []);

  const timeBasedProducts = React.useMemo(() => {
    const map = {
      morning: ['breakfast', 'dairy', 'bakery'],
      afternoon: ['lunch', 'snacks', 'beverages'],
      evening: ['dinner', 'beverages', 'snacks']
    };
    const tags = map[timeOfDay] || [];
    return productsList.filter(p => {
      if (!p.tags) return false;
      const t = Array.isArray(p.tags) ? p.tags : (String(p.tags).split(',') || []).map(s => s.trim());
      return t.some(tag => tags.includes(String(tag).toLowerCase()));
    }).slice(0, 8);
  }, [productsList, timeOfDay]);

  // day-of-week based recommendations (e.g., Monday -> healthy)
  const dayOfWeek = React.useMemo(() => {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    return days[new Date().getDay()];
  }, []);

  // normalize server-provided day/festival maps (keys -> lowercase, values -> array)
  const serverDays = React.useMemo(() => {
    const raw = (homeConfig && homeConfig.days) ? homeConfig.days : {};
    const out = {};
    Object.entries(raw).forEach(([k, v]) => {
      const kk = String(k || '').trim().toLowerCase();
      if (!kk) return;
      if (Array.isArray(v)) out[kk] = v.map(x => String(x).trim().toLowerCase()).filter(Boolean);
      else out[kk] = String(v || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    });
    return out;
  }, [homeConfig]);

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

  // day-based products using serverDays (fall back to built-in mapping)
  const dayBasedProducts = React.useMemo(() => {
    const map = Object.keys(serverDays).length ? serverDays : {
      monday: ['healthy', 'organic', 'salad'],
      tuesday: ['italian', 'pasta', 'snacks'],
      wednesday: ['quick', 'ready-to-eat', 'snacks'],
      thursday: ['baking', 'dairy', 'bakery'],
      friday: ['party', 'beverages', 'chips'],
      saturday: ['grill', 'meat', 'seafood'],
      sunday: ['family', 'bulk', 'groceries']
    };
    const tags = map[dayOfWeek] || [];
    return productsList.filter(p => {
      if (!p.tags) return false;
      const t = Array.isArray(p.tags) ? p.tags : (String(p.tags).split(',') || []).map(s => s.trim().toLowerCase());
      return t.some(tag => tags.includes(String(tag).toLowerCase()));
    }).slice(0, 8);
  }, [productsList, dayOfWeek, serverDays]);

  // Build festival sections from serverFestivals. Render a section for every festival key that yields products.
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

  const popularProducts = React.useMemo(() => {
    return [...productsList].sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0)).slice(0, 8);
  }, [productsList]);

  const offers = React.useMemo(() => {
    return productsList.filter(p => (p.discount || p.discountPercent || p.discountAmount) > 0).slice(0, 8);
  }, [productsList]);

  const quickBuys = React.useMemo(() => {
    return productsList.filter(p => p.inStock !== false).slice(0, 8);
  }, [productsList]);

  const banners = React.useMemo(() => {
    // bannersData may be an array or an object keyed by id
    const global = [];
    if (bannersData) {
      if (Array.isArray(bannersData)) {
        global.push(...bannersData.map((b, i) => ({ id: b.id || `b-${i}`, ...b })));
      } else {
        Object.entries(bannersData).forEach(([id, b]) => global.push({ id, ...b }));
      }
    }

    // simple personalization: promote category of last cart item
    const personalized = [];
    try {
      if (cartItems && cartItems.length) {
        const last = cartItems[0];
        const cat = last.product?.category || last.product?.categoryId;
        if (cat) {
          personalized.push({ id: 'p-cart-cat', title: 'Recommended for you', subtitle: last.product?.name, image: last.product?.image || last.product?.imageUrl, ctaLink: `/category/${cat}` });
        }
      }
    } catch (e) {}

    return [...personalized, ...global];
  }, [bannersData, cartItems]);

  if (loading) return <Loader />;

  return (
    <main className="space-y-8 pb-8">

       {/* Banners */}
      <section>
        <BannerCarousel banners={banners} />
      </section>
     

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
              Fresh Groceries Delivered Fast
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Order fresh groceries and daily essentials with quick delivery
            </p>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="max-w-7xl mx-auto px-4">
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-600 font-medium mb-2">Failed to load categories</div>
            <div className="text-sm text-gray-600">{error}</div>
          </div>
        ) : categories && categories.length ? (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/category/${col.slug || col.id}`}
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

     

      {/* Dynamic Home Sections */}
      <section className="max-w-7xl mx-auto px-4 space-y-6">
        {timeBasedProducts && timeBasedProducts.length > 0 && (
          <HomeSection
            title={timeOfDay === 'morning' ? 'Good Morning' : timeOfDay === 'afternoon' ? 'Good Afternoon' : 'Good Evening'}
            subtitle="Handpicked for this time"
            products={timeBasedProducts}
            layout="carousel"
            limit={8}
          />
        )}

        {dayBasedProducts && dayBasedProducts.length > 0 && (
          <HomeSection
            title={"Today's Picks"}
            subtitle={`Best for ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`}
            products={dayBasedProducts}
            layout="carousel"
            limit={8}
          />
        )}

        {/* render festival sections configured on server */}
        {festivalSections && festivalSections.length > 0 && festivalSections.map(s => (
          <HomeSection key={`fest-${s.key}`} title={s.title} subtitle="Festive essentials" products={s.products} layout="grid" limit={8} />
        ))}

        {popularProducts && popularProducts.length > 0 && (
          <HomeSection
            title="Popular near you"
            products={popularProducts}
            layout="carousel"
            limit={8}
          />
        )}

        {offers && offers.length > 0 && (
          <HomeSection
            title="Deals & Offers"
            products={offers}
            layout="grid"
            limit={8}
          />
        )}

        <RecommendationsSection title="Recommended for You" limit={8} />

        {quickBuys && quickBuys.length > 0 && (
          <HomeSection
            title="Quick Buys"
            subtitle="Everyday essentials"
            products={quickBuys}
            layout="grid"
            limit={8}
          />
        )}
      </section>

    </main>
  );
}
