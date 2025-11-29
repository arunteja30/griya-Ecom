import React, { useState, useMemo, useEffect } from "react";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import FilterBar from "../components/FilterBar";
import MobileFilterButton from "../components/MobileFilterButton";
import { db } from '../firebase';
import { ref, query, orderByKey, startAt, limitToFirst, get, onValue } from 'firebase/database';

export default function AllProductsPage() {
  const PAGE_SIZE = 24;

  // categories for left sidebar
  const [categories, setCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');

  // global products pagination (when no category selected)
  const [productsList, setProductsList] = useState([]);
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // category-indexed pagination state
  const [catProductIds, setCatProductIds] = useState([]);
  const [catLastKey, setCatLastKey] = useState(null);
  const [catHasMore, setCatHasMore] = useState(true);
  const [catLoading, setCatLoading] = useState(false);
  const [catLoadingMore, setCatLoadingMore] = useState(false);
  const [catProductsMap, setCatProductsMap] = useState({});

  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [priceRange, setPriceRange] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);

  // load categories once
  useEffect(() => {
    const r = ref(db, '/categories');
    const unsub = onValue(r, snap => setCategories(snap.val() || {}));
    return () => unsub && unsub();
  }, []);

  // initial load for global products
  useEffect(() => {
    let mounted = true;
    async function fetchFirst() {
      setLoading(true);
      try {
        const q = query(ref(db, '/products'), orderByKey(), limitToFirst(PAGE_SIZE));
        const snap = await get(q);
        const val = snap.exists() ? snap.val() : null;
        const items = val ? Object.entries(val).map(([k, v]) => ({ id: k, ...v })) : [];
        if (!mounted) return;
        setProductsList(items);
        setLastKey(items.length ? items[items.length - 1].id : null);
        setHasMore(items.length === PAGE_SIZE);
      } catch (e) {
        console.error('Failed to load products page', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchFirst();
    return () => { mounted = false; };
  }, []);

  // load first page for selected category using /categoryProducts index
  useEffect(() => {
    let mounted = true;
    async function fetchCategoryFirst(catId) {
      if (!catId) return;
      setCatLoading(true);
      try {
        const q = query(ref(db, `/categoryProducts/${catId}`), orderByKey(), limitToFirst(PAGE_SIZE));
        const snap = await get(q);
        const val = snap.exists() ? snap.val() : null;
        const ids = val ? Object.keys(val) : [];
        if (!mounted) return;
        setCatProductIds(ids);
        setCatLastKey(ids.length ? ids[ids.length - 1] : null);
        setCatHasMore(ids.length === PAGE_SIZE);

        // batch-fetch product details
        const prodPromises = ids.map(id => get(ref(db, `/products/${id}`)));
        const prodSnaps = await Promise.all(prodPromises);
        const map = {};
        prodSnaps.forEach(s => { if (s.exists()) map[s.key] = s.val(); });
        if (!mounted) return;
        setCatProductsMap(map);
      } catch (e) {
        console.error('Failed to load category products', e);
      } finally {
        if (mounted) setCatLoading(false);
      }
    }

    if (selectedCategory) {
      fetchCategoryFirst(selectedCategory);
    }

    // clear category data when unselecting
    if (!selectedCategory) {
      setCatProductIds([]);
      setCatProductsMap({});
      setCatLastKey(null);
      setCatHasMore(true);
    }

    return () => { mounted = false; };
  }, [selectedCategory]);

  const loadMoreGlobal = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(ref(db, '/products'), orderByKey(), startAt(lastKey), limitToFirst(PAGE_SIZE + 1));
      const snap = await get(q);
      const val = snap.exists() ? snap.val() : null;
      const items = val ? Object.entries(val).map(([k, v]) => ({ id: k, ...v })) : [];
      let newItems = items;
      if (items.length && items[0].id === lastKey) newItems = items.slice(1);
      const merged = [...productsList, ...newItems];
      setProductsList(merged);
      setLastKey(merged.length ? merged[merged.length - 1].id : null);
      setHasMore(newItems.length === PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load more products', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMoreCategory = async () => {
    if (!catHasMore || catLoadingMore || !selectedCategory) return;
    setCatLoadingMore(true);
    try {
      const q = query(ref(db, `/categoryProducts/${selectedCategory}`), orderByKey(), startAt(catLastKey), limitToFirst(PAGE_SIZE + 1));
      const snap = await get(q);
      const val = snap.exists() ? snap.val() : null;
      const ids = val ? Object.keys(val) : [];
      let newIds = ids;
      if (ids.length && ids[0] === catLastKey) newIds = ids.slice(1);
      const merged = [...catProductIds, ...newIds];
      setCatProductIds(merged);
      setCatLastKey(merged.length ? merged[merged.length - 1] : null);
      setCatHasMore(newIds.length === PAGE_SIZE);

      const prodPromises = newIds.map(id => get(ref(db, `/products/${id}`)));
      const prodSnaps = await Promise.all(prodPromises);
      setCatProductsMap(prev => {
        const map = { ...prev };
        prodSnaps.forEach(s => { if (s.exists()) map[s.key] = s.val(); });
        return map;
      });
    } catch (e) {
      console.error('Failed to load more category products', e);
    } finally {
      setCatLoadingMore(false);
    }
  };

  // pick current list based on selection
  const currentLoadedProducts = selectedCategory
    ? catProductIds.map(id => ({ id, ...catProductsMap[id] })).filter(Boolean)
    : productsList;

  const filteredAndSortedProducts = useMemo(() => {
    if (!currentLoadedProducts) return [];
    let products = [...currentLoadedProducts];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      products = products.filter(p =>
        (p.name && p.name.toLowerCase().includes(s)) ||
        (p.description && p.description.toLowerCase().includes(s))
      );
    }

    if (filterInStock) products = products.filter(p => p.inStock !== false);

    if (priceRange !== 'all') {
      products = products.filter(p => {
        const price = p.price || 0;
        switch (priceRange) {
          case 'under50': return price < 50;
          case '50-100': return price >= 50 && price <= 100;
          case '100-200': return price > 100 && price <= 200;
          case 'above200': return price > 200;
          default: return true;
        }
      });
    }

    products.sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'price-low': return (a.price || 0) - (b.price || 0);
        case 'price-high': return (b.price || 0) - (a.price || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'popular': return (b.orderCount || 0) - (a.orderCount || 0);
        default: return 0;
      }
    });

    return products;
  }, [currentLoadedProducts, searchTerm, sortBy, priceRange, filterInStock]);

  if (loading || (selectedCategory && catLoading)) return <Loader />;

  return (
    <div className="w-full px-0 py-0">
      <div className="w-full">
        <div className="md:flex md:gap-6">
          {/* Desktop filters sidebar */}
          <aside className="hidden md:block md:w-72 shrink-0">
            <div className="sticky top-28">
              <FilterBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortBy={sortBy}
                setSortBy={setSortBy}
                priceRange={priceRange}
                setPriceRange={setPriceRange}
                filterInStock={filterInStock}
                setFilterInStock={setFilterInStock}
                resultCount={filteredAndSortedProducts.length}
                onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                vertical={true}
              />
            </div>
          </aside>

          {/* Main (filters moved to left on desktop) */}
          <main className="flex-1">
            <div className="text-center mb-4 sticky top-24 z-10">
              <h1 className="text-2xl font-bold text-gray-800">{selectedCategory ? (categories[selectedCategory]?.name || 'Category') : 'All Products'}</h1>
              <div className="mt-2 md:hidden">
                <div className="flex justify-center">
                  <div className="w-full max-w-xl px-4">
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search products..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Static filter controls: mobile and desktop */}
            <div className="mb-2 z-10">
              <div className="flex items-center justify-center md:justify-start px-4  md:hidden">
                <label className="sr-only">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full md:w-auto border border-gray-300 rounded-md px-3 py-2 "
                >
                  <option value="">All Categories</option>
                  {Object.entries(categories).map(([cid, c]) => (
                    <option key={cid} value={cid}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:hidden px-4">
                <MobileFilterButton
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  filterInStock={filterInStock}
                  setFilterInStock={setFilterInStock}
                  resultCount={filteredAndSortedProducts.length}
                  onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                  // pass categories so FilterBar inside MobileFilterButton can render them
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
              </div>
            </div>

            {/* Scrollable products area - header, filters and sidebar remain static */}
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="md:hidden mb-4 -mx-4 px-4">
                <div className="pl-0">
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                    {filteredAndSortedProducts.map(p => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>

                  {filteredAndSortedProducts.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">🔍</div>
                      <h3 className="text-lg font-medium text-gray-600 mb-2">No products found</h3>
                      <p className="text-gray-500">Try adjusting your search or filters</p>
                    </div>
                  )}

                  {/* Load more (mobile) */}
                  {selectedCategory ? (
                    catHasMore && (
                      <div className="text-center mt-6">
                        <button onClick={loadMoreCategory} className="px-4 py-2 bg-black text-white rounded" disabled={catLoadingMore}>
                          {catLoadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    )
                  ) : (
                    hasMore && (
                      <div className="text-center mt-6">
                        <button onClick={loadMoreGlobal} className="px-4 py-2 bg-black text-white rounded" disabled={loadingMore}>
                          {loadingMore ? 'Loading...' : 'Load more'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="hidden md:grid md:grid-cols-6 gap-4">
                {filteredAndSortedProducts.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              <div className="hidden md:block">
                {filteredAndSortedProducts.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">🔍</div>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No products found</h3>
                    <p className="text-gray-500">Try adjusting your search or filters</p>
                  </div>
                )}

                {/* Load more (desktop) */}
                {selectedCategory ? (
                  catHasMore && (
                    <div className="text-center mt-6">
                      <button onClick={loadMoreCategory} className="px-4 py-2 bg-black text-white rounded" disabled={catLoadingMore}>
                        {catLoadingMore ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )
                ) : (
                  hasMore && (
                    <div className="text-center mt-6">
                      <button onClick={loadMoreGlobal} className="px-4 py-2 bg-black text-white rounded" disabled={loadingMore}>
                        {loadingMore ? 'Loading...' : 'Load more'}
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
