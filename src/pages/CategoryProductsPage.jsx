import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useCategoryBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();

  // data hooks (stable order)
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);
  const { data: productsData, loading: prodLoading } = useFirebaseList("/products");
  const { data: homeConfig, loading: homeLoading } = useFirebaseList("/homeConfig");

  // UI state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevance");
  const [visible, setVisible] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

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
  }, [products, category, festivalTags, query, sort]);

  const visibleItems = filtered.slice(0, visible);

  if (catLoading || prodLoading || homeLoading) return <Loader />;
  if (!category && !festivalTags) return <div className="py-12 text-center">Category not found</div>;

  return (
    <div className="section-container py-8">
      {/* Category hero */}
      <div className="mb-6">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-primary-900">{category ? category.name : (categorySlug ? (categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)) : 'Products')}</h2>
          {category && category.description && <p className="text-neutral-600 mt-2">{category.description}</p>}
          {!category && festivalTags && <p className="text-neutral-600 mt-2">Browse curated picks</p>}
        </div>
      </div>

      {/* Main layout: filters on left, products on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-4">
        <aside className="lg:col-span-3">
          <div className="card p-4 sticky top-24">
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
            <div>
              <h5 className="text-sm font-semibold mb-2">Quick Filters</h5>
              <div className="flex flex-col gap-2">
                <button className="category-pill text-sm" onClick={() => setQuery("")}>All</button>
                <button className="category-pill text-sm" onClick={() => setQuery("ring")}>Rings</button>
                <button className="category-pill text-sm" onClick={() => setQuery("neck")}>Necklaces</button>
                <button className="category-pill text-sm" onClick={() => setQuery("ear")}>Earrings</button>
              </div>
            </div>
            <div className="mt-4 hidden lg:block">
              <button className="btn btn-ghost w-full" onClick={() => { setQuery(""); setSort('relevance'); }}>Reset</button>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-9">
          {/* toolbar for small screens remains below hero, so products grid here */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
        </main>
      </div>

      {/* Mobile filters drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute left-0 top-0 h-full w-80 bg-white p-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Filters</h4>
              <button className="btn btn-ghost" onClick={() => setShowFilters(false)}>Close</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Search</label>
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="form-input" placeholder="Search products" />
            </div>

            <div>
              <h5 className="text-sm font-semibold mb-2">Quick links</h5>
              <div className="flex flex-col gap-2">
                <button className="text-sm text-neutral-700 hover:text-primary-600 text-left" onClick={() => { setQuery(""); setShowFilters(false); }}>All</button>
                <button className="text-sm text-neutral-700 hover:text-primary-600 text-left" onClick={() => { setQuery("ring"); setShowFilters(false); }}>Rings</button>
                <button className="text-sm text-neutral-700 hover:text-primary-600 text-left" onClick={() => { setQuery("neck"); setShowFilters(false); }}>Necklaces</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
