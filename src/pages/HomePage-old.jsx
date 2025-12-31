import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";
import { useFirebaseList } from "../hooks/useFirebase";
import { getCategories } from "../firebaseApi";
import { useSiteSettings } from '../hooks/useRealtime';

import RecommendationsSection from "../components/RecommendationsSection";
import HomeSection from "../components/HomeSection";
import BannerCarousel from "../components/BannerCarousel";
import { useCart } from '../context/CartContext';
import * as locationService from '../utils/locationService';
import { isLocationServiceable, fallbackPincodeServiceable } from '../utils/deliveryArea';

export default function HomePage() {
  const { data: siteSettings } = useSiteSettings();
  const appBg = siteSettings?.theme?.appBackground;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { data: productsData } = useFirebaseList("/products");
  const { data: bannersData } = useFirebaseList('/banners');
  // read server-configured recommendation maps (optional)
  const { data: homeConfig } = useFirebaseList('/homeConfig');
  const { cartItems } = useCart();
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [serviceable, setServiceable] = useState(null); // null = unknown/not-detected, true/false = result
  const [detected, setDetected] = useState({ city: '', pincode: '', weather: null });
  const [manualPincode, setManualPincode] = useState('');

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

    // detect location and check serviceability once siteSettings are available
    async function detectAndCheck() {
      try {
        if (!navigator.geolocation) throw new Error('Geolocation not available');
        // This will prompt the user for permission if not already granted
        const pos = await locationService.getCurrentPosition({ timeout: 8000 }).catch((e) => { throw e; });
        if (!mounted) return;
        const addr = await locationService.reverseGeocode(pos.lat, pos.lon).catch(() => ({ city: '', postcode: '' }));
        const weather = await locationService.getWeather(pos.lat, pos.lon).catch(() => null);
        const pincode = addr.postcode || '';
        // Prefer lat/lon geofence if configured; default radius is 5 km if not set on server
        const radiusKm = Number(siteSettings?.deliveryRadiusKm ?? 5);
        const svc = (siteSettings?.storeLocation)
          ? isLocationServiceable(pos.lat, pos.lon, { ...siteSettings, deliveryRadiusKm: radiusKm })
          : fallbackPincodeServiceable(pincode, siteSettings || {});
        if (!mounted) return;
        setDetected({ city: addr.city || '', pincode, weather, lat: pos.lat, lon: pos.lon });
        setServiceable(Boolean(svc));
      } catch (e) {
        // detection failed; leave serviceable as null
        console.warn('Location detection failed or denied', e);
        setServiceable(null);
      } finally {
        if (mounted) setCheckingLocation(false);
      }
    }

    // Only start detecting after siteSettings loaded (so we can compare against server config)
    if (siteSettings) {
      detectAndCheck();
    } else {
      // poll or wait until siteSettings available; simple timeout fallback
      const t = setInterval(() => {
        if (siteSettings) {
          clearInterval(t);
          detectAndCheck();
        }
      }, 300);
      // give up after 8s
      setTimeout(() => { clearInterval(t); if (mounted) setCheckingLocation(false); }, 8000);
    }

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
      if (prods.length) sections.push({ key: festKey, title: `${festKey.charAt(0).toUpperCase()+festKey.slice(1)} `, products: prods });
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

  // --- Home config driven sections ---
  const showConfig = (homeConfig && homeConfig.show) ? homeConfig.show : {};

  const getProductsFromConfig = (key) => {
    const arr = homeConfig && homeConfig[key];
    if (!arr || !arr.length) return null;
    const norm = arr.map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
    if (!norm.length) return null;
    const matched = productsList.filter(p => {
      if (!p) return false;
      if (p.id && norm.includes(String(p.id).toLowerCase())) return true;
      const tags = Array.isArray(p.tags) ? p.tags.map(t => String(t||'').trim().toLowerCase()) : (String(p.tags||'').split(',').map(s=>s.trim().toLowerCase()));
      return tags.some(t => norm.includes(t));
    }).slice(0, 8);
    return matched.length ? matched : null;
  };

  const dealsProducts = getProductsFromConfig('deals') || offers;
  const quickBuysProducts = getProductsFromConfig('quickBuys') || quickBuys;
  const recommendedProducts = getProductsFromConfig('recommended');
  const popularProductsFinal = getProductsFromConfig('popular') || popularProducts;
  const showFestivals = showConfig.festivals !== false; // default true

  // If still loading categories or checking location, show Loader
  const restrictionsConfigured = Boolean((siteSettings?.storeLocation && (siteSettings?.deliveryRadiusKm || siteSettings?.deliveryRadius)) || siteSettings?.serviceablePincodes);

  if (loading) return <Loader />;

  // If restrictions are configured on server, wait for location check to finish before showing the content
  if (restrictionsConfigured && checkingLocation) return <Loader />;

  // If we determined not serviceable, show a message and allow manual pincode check
  if (serviceable === false) {
    return (
      <main className="space-y-4 pb-6">
        <section className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h2 className="text-2xl font-bold mb-2">We do not deliver to your area</h2>
          <p className="text-gray-600 mb-4">Our service currently doesn't cover {detected.city || 'your location'} ({detected.pincode || 'unknown pincode'}).</p>
          <div className="max-w-sm mx-auto flex gap-2">
            <input value={manualPincode} onChange={(e) => setManualPincode(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="Enter pincode" className="w-full px-3 py-2 border rounded" />
            <button onClick={() => {
              const svc = fallbackPincodeServiceable(manualPincode, siteSettings || {});
              setServiceable(Boolean(svc));
              if (svc) setDetected((d) => ({ ...d, pincode: manualPincode }));
            }} className="px-4 py-2 bg-orange-500 text-white rounded">Check</button>
          </div>
          <div className="mt-4 text-sm text-gray-500">Or you can still browse the store, but we may not deliver to your address.</div>
          <div className="mt-4">
            <button onClick={() => setServiceable(true)} className="px-4 py-2 border rounded">Continue anyway</button>
          </div>
        </section>
      </main>
    );
  }

  // If restrictions configured and serviceability is still unknown (e.g., user denied location and didn't enter pincode), prompt user
  if (restrictionsConfigured && serviceable === null) {
    return (
      <main className="space-y-4 pb-6">
        <section className="max-w-3xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">📍</div>
          <h2 className="text-2xl font-bold mb-2">Check delivery availability</h2>
          <p className="text-gray-600 mb-4">We need to know your location to show if we deliver to your area. Please allow location access or enter your pincode.</p>
          <div className="flex gap-2 justify-center mb-4">
            <button onClick={async () => {
              setCheckingLocation(true);
              try {
                const pos = await locationService.getCurrentPosition({ timeout: 8000 });
                const addr = await locationService.reverseGeocode(pos.lat, pos.lon).catch(()=>({ postcode: '' }));
                const weather = await locationService.getWeather(pos.lat, pos.lon).catch(()=>null);
                const pincode = addr.postcode || '';
                const radiusKm = Number(siteSettings?.deliveryRadiusKm ?? 5);
                const svc = (siteSettings?.storeLocation)
                  ? isLocationServiceable(pos.lat, pos.lon, { ...siteSettings, deliveryRadiusKm: radiusKm })
                  : fallbackPincodeServiceable(pincode, siteSettings || {});
                setDetected({ city: addr.city || '', pincode, weather, lat: pos.lat, lon: pos.lon });
                setServiceable(Boolean(svc));
              } catch (e) {
                console.warn('Location detect failed', e);
                setServiceable(null);
              } finally { setCheckingLocation(false); }
            }} className="px-4 py-2 bg-orange-500 text-white rounded">Detect my location</button>
            <div className="flex items-center gap-2">
              <input value={manualPincode} onChange={(e) => setManualPincode(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="Enter pincode" className="px-3 py-2 border rounded" />
              <button onClick={() => {
                const svc = fallbackPincodeServiceable(manualPincode, siteSettings || {});
                setServiceable(Boolean(svc));
                if (svc) setDetected((d) => ({ ...d, pincode: manualPincode }));
              }} className="px-4 py-2 bg-orange-500 text-white rounded">Check</button>
            </div>
          </div>
          <div className="text-sm text-gray-500">You can also continue browsing, but delivery may not be available to your address.</div>
          <div className="mt-4">
            <button onClick={() => setServiceable(true)} className="px-4 py-2 border rounded">Continue anyway</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-6">

       {/* Banners */}
      <section>
        <BannerCarousel banners={banners} />
      </section>
     

      {/* Hero Section (uses theme app background) */}
     <section style={{ background: appBg || undefined }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
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
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">Shop by Category</h2>
            {/* compact grid: smaller cards/images on mobile */}
            <div className="grid grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {categories.map((col) => (
                <Link
                  key={col.id}
                  to={`/category/${col.slug || col.id}`}
                  className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100"
                >
                  <div className="relative aspect-square bg-gradient-to-br from-orange-50 to-orange-100">
                    <img
                      src={normalizeImageUrl(col?.image || col?.imageUrl || '/placeholder.jpg')}
                      alt={col?.title || col?.name || col.id}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-200" />
                  </div>
                  <div className="p-2 text-center">
                    <div className="font-medium text-gray-800 text-xs group-hover:text-orange-600 transition-colors line-clamp-2">
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
      <section className="max-w-7xl mx-auto px-4 space-y-4">
        {timeBasedProducts && timeBasedProducts.length > 0 && (
          <HomeSection
            title={timeOfDay === 'morning' ? 'Good Morning' : timeOfDay === 'afternoon' ? 'Good Afternoon' : 'Good Evening'}
            subtitle="Handpicked for this time"
            products={timeBasedProducts}
            layout="carousel"
            seeAllLink="/groceries"
            limit={8}
          />
        )}

        {dayBasedProducts && dayBasedProducts.length > 0 && (
          <HomeSection
            title={"Today's Picks"}
            subtitle={`Best for ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}`}
            products={dayBasedProducts}
            layout="carousel"
            seeAllLink="/groceries"
             limit={8}
           />
         )}

         {/* render festival sections configured on server (respect admin toggle) */}
         {showFestivals && festivalSections && festivalSections.length > 0 && festivalSections.map(s => (
           <HomeSection
             key={`fest-${s.key}`}
             title={s.title}
             subtitle="Festive essentials"
             products={s.products}
             layout="grid"
             limit={8}
             seeAllLink={`/category/${encodeURIComponent(s.key)}`}
           />
         ))}

         {/* Popular (configurable) */}
         {showConfig.popular !== false && popularProductsFinal && popularProductsFinal.length > 0 && (
           <HomeSection
             title="Popular near you"
             products={popularProductsFinal}
             layout="carousel"
             seeAllLink="/groceries"
             limit={8}
           />
         )}

         {/* Deals (configurable) */}
         {showConfig.deals !== false && dealsProducts && dealsProducts.length > 0 && (
           <HomeSection
             title="Deals & Offers"
             products={dealsProducts}
             layout="grid"
             seeAllLink="/category/Deals"
             limit={8}
           />
         )}

         {/* Recommended: prefer admin-provided list, else use RecommendationsSection */}
         {showConfig.recommended !== false && (recommendedProducts && recommendedProducts.length > 0 ? (
           <HomeSection
             title="Recommended for You"
             products={recommendedProducts}
             layout="carousel"
             seeAllLink="/groceries"
             limit={8}
           />
         ) : (
           <RecommendationsSection title="Recommended for You" limit={8} />
         ))}

         {/* Quick Buys (configurable) */}
         {showConfig.quickBuys !== false && quickBuysProducts && quickBuysProducts.length > 0 && (
           <HomeSection
             title="Quick Buys"
             subtitle="Everyday essentials"
             products={quickBuysProducts}
             layout="grid"
             seeAllLink="/groceries"
             limit={8}
           />
         )}
      </section>

    </main>
  );
}
