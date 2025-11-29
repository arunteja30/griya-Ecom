import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductsByCategory, getCategories } from '../firebaseApi';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import SectionTitle from '../components/SectionTitle';
import FilterBar from '../components/FilterBar';
import MobileFilterButton from '../components/MobileFilterButton';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';

export default function CategoryPage() {
  const { categoryId } = useParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryName, setCategoryName] = useState(null);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const navigate = useNavigate();
  // filters
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [priceRange, setPriceRange] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        // resolve categories to find canonical id if a slug was provided
        const cats = await getCategories();
        // populate categories dropdown map for filters
        if (mounted && Array.isArray(cats)) {
          const map = Object.fromEntries((cats || []).map(c => [c.id, c]));
          setCategoriesMap(map);
        }
        const found = (cats || []).find((c) => String(c.id) === String(categoryId) || String(c.slug) === String(categoryId));
        const resolvedId = found ? found.id : categoryId;
        // set a friendly category name for the UI
        if (mounted) setCategoryName(found?.name || found?.title || String(categoryId));

        // If this categoryId matches a festival key under /homeConfig/festivals, use that festival's tag list
        try {
          const festSnap = await get(ref(db, '/homeConfig/festivals'));
          if (festSnap.exists()) {
            const festivals = festSnap.val() || {};
            const matchKey = Object.keys(festivals).find(k => String(k || '').toLowerCase() === String(categoryId).toLowerCase());
            if (matchKey) {
              const tags = Array.isArray(festivals[matchKey]) ? festivals[matchKey] : (String(festivals[matchKey] || '').split(',').map(s => s.trim()).filter(Boolean));
              if (tags && tags.length) {
                const tagSet = new Set(tags.map(t => String(t || '').toLowerCase()));
                const allSnap2 = await get(ref(db, '/products'));
                const matched = [];
                if (allSnap2.exists()) {
                  const all = allSnap2.val();
                  Object.entries(all).forEach(([k, v]) => {
                    const p = { id: k, ...v };
                    const prodTags = p.tags ? (Array.isArray(p.tags) ? p.tags : String(p.tags).split(',').map(s => s.trim())) : [];
                    const normalized = prodTags.map(t => String(t || '').toLowerCase());
                    if (normalized.some(t => tagSet.has(t))) matched.push(p);
                  });
                }
                if (mounted) {
                  setProducts(matched);
                  setLoading(false);
                }
                return;
              }
            }
          }
        } catch (e) {
          console.error('Failed reading homeConfig for festival tags', e);
        }

        // Try categoryProducts index first (fast path)
        const idxSnap = await get(ref(db, `/categoryProducts/${resolvedId}`));
        if (idxSnap.exists()) {
          const ids = Object.keys(idxSnap.val() || {});
          // batch fetch product details
          const prodPromises = ids.map(id => get(ref(db, `/products/${id}`)));
          const prodSnaps = await Promise.all(prodPromises);
          const products = [];
          prodSnaps.forEach(s => { if (s.exists()) products.push({ id: s.key, ...s.val() }); });
          if (mounted) {
            setProducts(products);
            setLoading(false);
          }
          return;
        }

        // Fallback: scan products and match by category fields
        const prods = await getProductsByCategory(categoryId);
        if (mounted) {
          if (prods && prods.length) {
            setProducts(prods);
            setLoading(false);
          } else {
            // As a last resort, try matching by tags (support arrays or comma-separated strings)
            try {
              const allSnap = await get(ref(db, '/products'));
              const matched = [];
              if (allSnap.exists()) {
                const all = allSnap.val();
                Object.entries(all).forEach(([k, v]) => {
                  const p = { id: k, ...v };
                  const tags = p.tags ? (Array.isArray(p.tags) ? p.tags : String(p.tags).split(',').map(s => s.trim())) : [];
                  const normalizedTags = tags.map(t => String(t || '').toLowerCase());
                  if (normalizedTags.includes(String(categoryId).toLowerCase()) || normalizedTags.includes((found && found.slug || '').toLowerCase())) {
                    matched.push(p);
                  }
                });
              }
              setProducts(matched);
            } catch (err) {
              console.error('Failed tag-based lookup', err);
              setProducts([]);
            } finally {
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load products for category', err);
        setError(err.message || 'Failed to load products');
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [categoryId]);

  // filtering + sorting applied on client-side
  const filteredAndSortedProducts = React.useMemo(() => {
    if (!products) return [];
    let list = [...products];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p => (p.name && p.name.toLowerCase().includes(s)) || (p.description && p.description.toLowerCase().includes(s)));
    }

    if (filterInStock) list = list.filter(p => p.inStock !== false);

    if (priceRange !== 'all') {
      list = list.filter(p => {
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

    list.sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'price-low': return (a.price || 0) - (b.price || 0);
        case 'price-high': return (b.price || 0) - (a.price || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'popular': return (b.orderCount || 0) - (a.orderCount || 0);
        default: return 0;
      }
    });

    return list;
  }, [products, searchTerm, sortBy, priceRange, filterInStock]);

  if (loading) return <Loader />;

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{categoryName || `${categoryId}`}</h1>
        <div className="flex items-center gap-2">
          <Link to="/groceries" className="btn btn-ghost">Browse Groceries</Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border p-6 bg-white text-center">
          <div className="text-red-600 font-medium mb-2">Failed to load products</div>
          <div className="text-sm text-neutral-600">{error}</div>
        </div>
      ) : filteredAndSortedProducts && filteredAndSortedProducts.length ? (
        <div className="md:flex md:gap-6">
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
                searchPlaceholder="Search products..."
                onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                showPriceFilter={true}
                showStockFilter={true}
                compact={true}
                vertical={true}
                showCategoryFilter={true}
                categories={categoriesMap}
                selectedCategory={selectedCategory}
                setSelectedCategory={(v)=>{ setSelectedCategory(v); if(v) navigate(`/category/${v}`); }}
              />
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-4">
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
                  searchPlaceholder="Search products..."
                  onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                  categories={categoriesMap}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={(v)=>{ setSelectedCategory(v); if(v) navigate(`/category/${v}`); }}
                />
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {filteredAndSortedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className="md:flex md:gap-6">
          {/* Sidebar filters (visible on desktop) */}
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
                searchPlaceholder="Search products..."
                onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                showPriceFilter={true}
                showStockFilter={true}
                compact={true}
                vertical={true}
                showCategoryFilter={true}
                categories={categoriesMap}
                selectedCategory={selectedCategory}
                setSelectedCategory={(v)=>{ setSelectedCategory(v); if(v) navigate(`/category/${v}`); }}
              />
            </div>
          </aside>

          {/* Main: no-results message and mobile filter control */}
          <main className="flex-1">
            <div className="mb-4 md:hidden px-4">
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
                searchPlaceholder="Search products..."
                onClearFilters={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                categories={categoriesMap}
                selectedCategory={selectedCategory}
                setSelectedCategory={(v)=>{ setSelectedCategory(v); if(v) navigate(`/category/${v}`); }}
              />
            </div>

            <div className="card p-8 text-center">
              <h2 className="text-xl font-semibold mb-2">
                {(searchTerm || priceRange !== 'all' || filterInStock || sortBy !== 'name') ? 'No products match your filters' : 'No products found'}
              </h2>
              <p className="text-neutral-600 mb-6">
                {(searchTerm || priceRange !== 'all' || filterInStock || sortBy !== 'name') ? 'Try adjusting or clearing filters to see more products.' : 'There are no products in this category yet.'}
              </p>
              <div className="flex justify-center gap-3">
                {(searchTerm || priceRange !== 'all' || filterInStock || sortBy !== 'name') ? (
                  <>
                    <button
                      onClick={() => { setSearchTerm(''); setPriceRange('all'); setFilterInStock(false); setSortBy('name'); }}
                      className="btn btn-primary"
                    >
                      Clear filters
                    </button>
                    <Link to="/groceries" className="btn btn-ghost">Browse other groceries</Link>
                  </>
                ) : (
                  <>
                    <Link to="/groceries" className="btn btn-ghost">Browse other groceries</Link>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
