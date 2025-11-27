import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useFirebaseObject, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import { normalizeImageUrl } from "../utils/imageHelpers";

// Small helpers for rendering different section types
function HeroSection({ data }) {
  if (!data) return null;
  return (
    <section className="relative">
      <div className="w-full">
        <img src={normalizeImageUrl(data.image) || "/placeholder.jpg"} alt={data.title} className="w-full h-72 md:h-[420px] object-cover" />
        <div className={`hero-overlay ${data.compact ? 'hero-overlay--sm' : ''} absolute inset-0 flex items-center`}>
          <div className="hero-content">
            <h1 className="section-title text-white">{data.title}</h1>
            {data.subtitle && <p className="text-white/90 mb-4">{data.subtitle}</p>}
            {data.buttonUrl && (
              <a href={data.buttonUrl} className="btn btn-primary">{data.buttonText || 'Shop Now'}</a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DealsCarousel({ products }) {
  if (!products || products.length === 0) return null;
  return (
    <section className="py-6">
      <div className="section-container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Top Deals</h3>
          <Link to="/deals" className="text-sm text-neutral-600">See all</Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {products.map((p) => (
            <div key={p.id} className="min-w-[220px] card p-3">
              <Link to={`/product/${p.id}`} className="block">
                <img src={normalizeImageUrl(p.images?.[0]) || '/placeholder.jpg'} alt={p.name} className="w-full h-40 object-cover mb-3 rounded" />
                <div className="text-sm font-medium text-neutral-800 mb-1 line-clamp-2">{p.name}</div>
                <div className="text-sm text-accent-600 font-semibold">{p.price ? `₹${p.price}` : p.displayPrice || ''}</div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductGridSection({ title, productList }) {
  if (!productList || productList.length === 0) return null;
  return (
    <section className="py-8 bg-white">
      <div className="section-container">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold">{title}</h3>
          <Link to="/collections" className="text-sm text-neutral-600">Browse all</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {productList.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesSection({ categories }) {
  if (!categories || categories.length === 0) return null;
  return (
    <section className="py-8 mb-12">
      <div className="section-container">
        <h3 className="text-2xl font-semibold mb-6">Shop by Category</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {categories.map((c) => (
            <Link key={c.id || c.slug || c.name} to={`/category/${c.slug || c.id}`} className="card p-4 text-center hover:shadow-md">
              {/* Support multiple possible image fields in data: image, thumbnail, thumbnailUrl */}
              <img src={normalizeImageUrl(c.image || c.thumbnail || c.thumbnailUrl) || '/placeholder.jpg'} alt={c.name} className="w-full h-28 object-cover rounded mb-3" />
               <div className="font-medium text-sm text-neutral-700">{c.name}</div>
             </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ testimonials }) {
  if (!testimonials || Object.keys(testimonials).length === 0) return null;
  return (
    <section className="py-8 bg-gradient-to-br from-primary-50 to-accent-50">
      <div className="section-container">
        <h3 className="text-2xl font-semibold mb-6">What Our Customers Say</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(testimonials).map(([id, t]) => (
            <div key={id} className="card-glass p-6 text-center">
              <blockquote className="text-neutral-700 mb-4 italic">"{t.message ?? t.review}"</blockquote>
              <div className="font-medium">{t.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CarouselSection({ images, title }) {
  if (!images || images.length === 0) return null;

  // normalize slides: allow array of strings or objects { image, title, subtitle, buttonText, buttonUrl }
  const slides = images.map((it) => (typeof it === 'string' ? { image: it } : it || {}));
  const length = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (length <= 1) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!paused) setIndex(i => (i + 1) % length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [length, paused]);

  const prev = () => setIndex(i => (i - 1 + length) % length);
  const next = () => setIndex(i => (i + 1) % length);

  return (
    <section className="py-6">
      {title && <div className="section-container"><div className="flex items-center justify-between mb-4"><h3 className="text-xl font-semibold">{title}</h3></div></div>}

      <div className="relative">
        <div className="w-full overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="flex transition-transform duration-700" style={{ transform: `translateX(-${index * 100}%)` }}>
            {slides.map((slide, idx) => (
              <div key={idx} className="w-full flex-shrink-0 relative">
                <img src={normalizeImageUrl(slide.image) || '/placeholder.jpg'} alt={slide.title || `slide-${idx}`} className="w-full h-72 md:h-[420px] object-cover" />

                {/* Bottom-left overlay for heading and body */}
                <div className="absolute inset-0 flex items-end">
                  <div className="w-full bg-gradient-to-t from-black/65 via-transparent to-transparent px-6 py-6 md:py-10">
                    <div className="max-w-xl text-left">
                      {slide.title && <h2 className="text-white text-2xl md:text-3xl font-semibold leading-tight">{slide.title}</h2>}
                      {slide.subtitle && <p className="text-white/90 mt-2 text-sm md:text-base">{slide.subtitle}</p>}
                      {slide.body && <p className="text-white/90 mt-2 text-sm md:text-base">{slide.body}</p>}
                      {slide.buttonUrl && (
                        <a href={slide.buttonUrl} className="inline-block mt-4 btn btn-primary">{slide.buttonText || 'Learn more'}</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prev / Next buttons */}
        <button aria-label="Previous" onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-md">‹</button>
        <button aria-label="Next" onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full shadow-md">›</button>

        {/* Slide indicators */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 flex gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className={`w-3 h-3 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} aria-label={`Go to slide ${i+1}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { data: home, loading: homeLoading } = useFirebaseObject("/home");
  const { data: productsDataObj, loading: productsLoading } = useFirebaseList("/products");
  const products = productsDataObj ? productsDataObj : null;
  const { data: categoriesData } = useFirebaseList("/categories");

  // helpers
  const findProducts = (ids) => ids.map((id) => products?.[id]).filter(Boolean);
  const allProducts = products ? Object.values(products) : [];

  // Determine dynamic layout order using home.layout (array of keys) or fallback to the keys in home.sections
  const sectionsConfig = home?.sections || {};
  const layoutOrder = Array.isArray(home?.layout) && home.layout.length > 0 ? home.layout : Object.keys(sectionsConfig || {});

  // Active festivals configured by admin
  const activeFestivals = home?.activeFestivals || [];

  // Visibility evaluation for sections
  const isSectionVisible = (sec) => {
    if (!sec || !sec.visibility) return true;
    const v = sec.visibility || {};
    const type = (v.type || 'always').toLowerCase();
    if (type === 'always') return true;
    const now = new Date();
    if (type === 'time') {
      try {
        const start = v.start ? new Date(v.start) : null;
        const end = v.end ? new Date(v.end) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      } catch (e) {
        return true;
      }
    }
    if (type === 'festival') {
      const festList = Array.isArray(v.festivals) ? v.festivals : (typeof v.festivals === 'string' ? v.festivals.split(',').map(s=>s.trim()) : []);
      if (!festList || festList.length === 0) return false;
      return festList.some(f => (activeFestivals || []).map(a=>a.toLowerCase()).includes(String(f).toLowerCase()));
    }
    return true;
  };

  // compute visible layout with a hook — ensure this hook runs on every render to keep hooks order stable
  const visibleLayout = useMemo(() => layoutOrder.filter(k => isSectionVisible(sectionsConfig[k])), [layoutOrder, sectionsConfig, home?.activeFestivals]);

  // On slow mobile networks one listener may lag — show loader only when both are still loading.
  if (homeLoading && productsLoading) return <Loader />;

  // Debug info for mobile loading issues (non-invasive)
  try { console.debug('[HomePage] homeLoaded=', !homeLoading, 'productsLoaded=', !productsLoading, 'homeSections=', Object.keys(sectionsConfig || {}).length); } catch (e) {}

  return (
    <div className="bg-neutral-50">
      {visibleLayout.map((sectionKey) => {
         const section = sectionsConfig[sectionKey];
         if (!section) return null;

        // Section types can be explicit via section.type or inferred by key name
        const type = (section.type || sectionKey).toLowerCase();

        switch (type) {
          case 'hero':
            return <HeroSection key={sectionKey} data={section} />;

          case 'deals':
            return <DealsCarousel key={sectionKey} products={findProducts(section.productIds || [])} />;

          case 'carousel':
            // If the section has explicit images, render an image carousel.
            if (section.images && section.images.length) {
              return <CarouselSection key={sectionKey} images={section.images} title={section.title} />;
            }
            // Fallback: treat as deals carousel when productIds are present
            return <DealsCarousel key={sectionKey} products={findProducts(section.productIds || [])} />;

          case 'productlist':
            return (
              <ProductGridSection
                key={sectionKey}
                title={section.title || sectionKey}
                productList={findProducts(section.productIds || [])}
              />
            );

          case 'collectionlist':
            // map collectionIds to categories data (if available)
            const collections = (section.collectionIds || []).map(id => (categoriesData ? categoriesData[id] : null)).filter(Boolean);
            return <CategoriesSection key={sectionKey} categories={collections} />;

          case 'grid':
          case 'products':
          case 'bestsellers':
          case 'recommended':
            return (
              <ProductGridSection
                key={sectionKey}
                title={section.title || (sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1))}
                productList={findProducts(section.productIds || [])}
              />
            );

          case 'categories':
            return <CategoriesSection key={sectionKey} categories={categoriesData ? Object.values(categoriesData) : []} />;

          case 'testimonials':
            return <TestimonialsSection key={sectionKey} testimonials={home.testimonials || {}} />;

          case 'promo':
            return (
              <section key={sectionKey} className="py-8">
                <div className="section-container">
                  <div className="card p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{section.title}</h3>
                      <p className="text-neutral-600">{section.subtitle}</p>
                    </div>
                    {section.buttonUrl && (
                      <a href={section.buttonUrl} className="btn btn-accent">{section.buttonText || 'Explore'}</a>
                    )}
                  </div>
                </div>
              </section>
            );

          default:
            // Unknown section type — render as a generic product grid if it has productIds
            if (section.productIds && section.productIds.length > 0) {
              return (
                <ProductGridSection
                  key={sectionKey}
                  title={section.title || sectionKey}
                  productList={findProducts(section.productIds)}
                />
              );
            }
            return null;
        }
      })}

      {/* Footer CTA (optional, keep as last section) */}
      {home?.footerCta && (
        <section className="py-12 bg-primary-900 text-white">
          <div className="section-container text-center">
            <h3 className="text-2xl font-semibold mb-2">{home.footerCta.title}</h3>
            <p className="text-sm opacity-90 mb-4">{home.footerCta.subtitle}</p>
            {home.footerCta.buttonUrl && (
              <a href={home.footerCta.buttonUrl} className="btn btn-accent">{home.footerCta.buttonText || 'Learn more'}</a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
