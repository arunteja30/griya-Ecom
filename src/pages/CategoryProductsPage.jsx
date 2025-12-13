import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useCategoryBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();

  // data hooks (stable order)
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);
  const { data: productsData, loading: prodLoading } = useFirebaseList("/products");
  const { data: reviewsData } = useFirebaseList('/reviews');
  const { data: homeConfig, loading: homeLoading } = useFirebaseList("/homeConfig");

  // UI state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevance");
  const [visible, setVisible] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  // new filters
  const [ratingFilter, setRatingFilter] = useState(0); // 0 = any, 1..5
  const [onlyBestseller, setOnlyBestseller] = useState(false);

  // Normalize products into an array
  const products = productsData && typeof productsData === "object" ? Object.values(productsData) : [];

  // derive festival tags for this slug (if any)
  const festivalTags = useMemo(() => {
    if (!homeConfig || !homeConfig.festivals) return null;
    const raw = homeConfig.festivals[categorySlug];
    if (!raw) return null;
    const arr = Array.isArray(raw) ? raw : String(raw || '').split(',');
    return arr.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  }, [homeConfig, categorySlug]);

  // derive review aggregates per product so filters can use actual reviews
  const reviewsArray = reviewsData && typeof reviewsData === 'object' ? Object.entries(reviewsData).map(([id, r]) => ({ id, ...r })) : [];
  const reviewsByProduct = React.useMemo(() => {
    const m = {};
    reviewsArray.forEach(r => {
      if (!r) return;
      if (r.enabled === false) return; // ignore disabled
      const pid = r.productId;
      if (!pid) return;
      if (!m[pid]) m[pid] = { sum: 0, count: 0 };
      m[pid].sum += Number(r.rating) || 0;
      m[pid].count += 1;
    });
    Object.keys(m).forEach(k => { m[k].avg = m[k].count ? Math.round((m[k].sum / m[k].count) * 10) / 10 : 0; });
    return m;
  }, [reviewsData]);

  // Derived filtered/sorted list (memoized)
  const filtered = useMemo(() => {
    // if neither category nor festival tags, nothing to show
    if (!category && !festivalTags) return [];

    let list = [];

    if (category) {
      list = products.filter((p) => p.categoryId === category.id);
    } else if (festivalTags) {
      // filter products by matching any of the festival tags
      list = products.filter((p) => {
        if (!p.tags) return false;
        const t = Array.isArray(p.tags) ? p.tags : (String(p.tags).split(',') || []).map(s => s.trim().toLowerCase());
        return t.some(tag => festivalTags.includes(String(tag).toLowerCase()));
      });
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
    }

    // apply rating filter (use stored avgRating or fallback to rating or aggregated reviews)
    if (ratingFilter && Number(ratingFilter) > 0) {
      list = list.filter((p) => {
        const pid = p.id || p.slug || null;
        const aggregated = reviewsByProduct[pid];
        const aggAvg = aggregated ? aggregated.avg : 0;
        const r = Number(p.avgRating || p.rating || aggAvg || 0) || 0;
        return r >= Number(ratingFilter);
      });
    }

    // apply bestseller filter
    if (onlyBestseller) {
      list = list.filter((p) => Boolean(p.bestseller || p.isBestseller));
    }

    switch (sort) {
      case "price_asc":
        list.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price_desc":
        list.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "newest":
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        break;
      default:
        // relevance or default ordering
        break;
    }

    return list;
  }, [products, category, festivalTags, query, sort, ratingFilter, onlyBestseller, reviewsData]);

  const visibleItems = filtered.slice(0, visible);

  if (catLoading || prodLoading || homeLoading) return <Loader />;
  if (!category && !festivalTags) return <div className="py-12 text-center">Category not found</div>;

  return (
    <div className="w-full px-3 lg:px-8 py-4 sm:py-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}>
      {/* Mobile filter floating icon (bottom-right) */}
      <div className="lg:hidden">
        <button
          onClick={() => setShowFilters(true)}
          className="fixed right-4 z-50 bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-full shadow-lg flex items-center justify-center"
          aria-label="Open filters"
          title="Filters"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
        >
          {/* filter/funnel icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9v6l4 2v-8l8-9z" />
          </svg>
        </button>
      </div>

      {/* Category hero (fixed on mobile) */}
      <div className="lg:hidden">
        <div className="mobile-hero-fixed fixed left-0 right-0 z-30" style={{ top: 'env(safe-area-inset-top, 64px)', paddingLeft: '1rem', paddingRight: '1rem' }}>
          <div className="p-4 sm:p-6 bg-white shadow-sm rounded-b-md">
            <div className="flex items-center gap-5 mb-3">
              <Link to="/collections" aria-label="Back to collections" title="Back" className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <h2 className="text-2xl font-bold text-primary-900">{category ? category.name : (categorySlug ? (categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)) : 'Products')}</h2>
            </div>
            {category && category.description && <p className="text-neutral-600 mt-2">{category.description}</p>}
            {!category && festivalTags && <p className="text-neutral-600 mt-2">Browse curated picks</p>}
          </div>
        </div>
        {/* spacer to preserve layout space for fixed hero (reduced on mobile) */}
        <div className="mobile-hero-spacer h-16 sm:h-20" aria-hidden />
      </div>

      {/* Main layout: filters on left, products on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">
        <aside className="hidden lg:block lg:col-span-3">
          <div className="card p-4 sticky top-24">
            {/* Title moved into sidebar for large screens */}
            <div className="hidden lg:block mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Link to="/collections" aria-label="Back to collections" title="Back" className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                       <path d="M15 18l-6-6 6-6" />
                     </svg>
                   </Link>
                  <h2 className="text-2xl font-bold text-primary-900">{category ? category.name : (categorySlug ? (categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)) : 'Products')}</h2>
                </div>
              </div>
               {category && category.description && <p className="text-neutral-600 mt-1">{category.description}</p>}
               {!category && festivalTags && <p className="text-neutral-600 mt-1">Browse curated picks</p>}
             </div>

            <h4 className="font-semibold mb-3">Filters</h4>
            <div className="mb-3">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within category" className="form-input w-full" />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Sort</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input w-full">
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Rating</label>
              <select value={ratingFilter} onChange={(e) => setRatingFilter(Number(e.target.value))} className="form-input w-full">
                <option value={0}>Any rating</option>
                <option value={1}>1 star & up</option>
                <option value={2}>2 stars & up</option>
                <option value={3}>3 stars & up</option>
                <option value={4}>4 stars & up</option>
                <option value={5}>5 stars</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyBestseller} onChange={(e) => setOnlyBestseller(e.target.checked)} className="form-checkbox" />
                <span className="text-sm font-medium">Only show bestsellers</span>
              </label>
            </div>
            <div>
              {/* Quick Filters removed */}
             </div>
            <div className="mt-4 hidden lg:block">
              <button className="btn btn-ghost w-full" onClick={() => { setQuery(""); setSort('relevance'); setRatingFilter(0); setOnlyBestseller(false); }}>Reset</button>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9">
          {/* products: on mobile make product-list scrollable while hero stays fixed */}
          <div className="mobile-products-scroll overflow-y-auto" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
            <div className="mt-6 lg:mt-0 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {visibleItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>

            {filtered.length === 0 && <div className="py-12 text-center text-neutral-500">No products in this category.</div>}

            {visible < filtered.length && (
              <div className="mt-6 text-center">
                <button className="btn btn-primary px-6" onClick={() => setVisible((v) => v + 20)}>Load more</button>
              </div>
            )}
          </div>
         </main>
      </div>

      {/* Mobile filters bottom-sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="relative w-full max-h-[80vh] bg-white rounded-t-xl shadow-xl overflow-auto p-4" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Filters</h4>
              <button className="text-sm text-neutral-600" onClick={() => setShowFilters(false)}>Close</button>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Search</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="form-input w-full" placeholder="Search products" />
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Sort</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-input w-full">
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-sm font-medium mb-2">Rating</label>
              <select value={ratingFilter} onChange={(e) => setRatingFilter(Number(e.target.value))} className="form-input w-full">
                <option value={0}>Any rating</option>
                <option value={1}>1 star & up</option>
                <option value={2}>2 stars & up</option>
                <option value={3}>3 stars & up</option>
                <option value={4}>4 stars & up</option>
                <option value={5}>5 stars</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={onlyBestseller} onChange={(e) => setOnlyBestseller(e.target.checked)} className="form-checkbox" />
                <span className="text-sm font-medium">Only show bestsellers</span>
              </label>
            </div>

            <div className="mb-4">
              {/* Quick links removed for mobile filters */}
             </div>

            <div className="flex gap-2">
              <button onClick={() => { setQuery(""); setSort('relevance'); setRatingFilter(0); setOnlyBestseller(false); setShowFilters(false); }} className="flex-1 px-4 py-2 border rounded">Reset</button>
              <button onClick={() => setShowFilters(false)} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
