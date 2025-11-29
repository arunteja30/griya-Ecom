import React, { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCategoryBySlug } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";
import FilterBar from "../components/FilterBar";
import MobileFilterButton from "../components/MobileFilterButton";
import { db } from '../firebase';
import { ref, query, orderByKey, startAt, limitToFirst, get } from 'firebase/database';

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);

  const PAGE_SIZE = 24;
  const [productIds, setProductIds] = useState([]);
  const [lastKey, setLastKey] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productsMap, setProductsMap] = useState({}); // id -> product

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [priceRange, setPriceRange] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);

  // fetch first page of ids when category loads
  useEffect(() => {
    let mounted = true;
    async function fetchFirst(){
      if(!category) return;
      setLoading(true);
      try{
        const q = query(ref(db, `/categoryProducts/${category.id}`), orderByKey(), limitToFirst(PAGE_SIZE));
        const snap = await get(q);
        const val = snap.exists() ? snap.val() : null;
        const ids = val ? Object.keys(val) : [];
        if(!mounted) return;
        setProductIds(ids);
        setLastKey(ids.length ? ids[ids.length-1] : null);
        setHasMore(ids.length === PAGE_SIZE);

        // batch fetch product details
        const prodSnapPromises = ids.map(id => get(ref(db, `/products/${id}`)));
        const prodSnaps = await Promise.all(prodSnapPromises);
        const map = {};
        prodSnaps.forEach(s => { if(s.exists()) map[s.key] = s.val(); });
        if(!mounted) return;
        setProductsMap(map);
      }catch(e){
        console.error('Failed to load category products', e);
      }finally{
        if(mounted) setLoading(false);
      }
    }
    fetchFirst();
    return ()=>{ mounted = false; };
  }, [category]);

  const loadMore = async ()=>{
    if(!hasMore || loadingMore || !category) return;
    setLoadingMore(true);
    try{
      const q = query(ref(db, `/categoryProducts/${category.id}`), orderByKey(), startAt(lastKey), limitToFirst(PAGE_SIZE+1));
      const snap = await get(q);
      const val = snap.exists() ? snap.val() : null;
      const ids = val ? Object.keys(val) : [];
      let newIds = ids;
      if(ids.length && ids[0] === lastKey) newIds = ids.slice(1);
      const merged = [...productIds, ...newIds];
      setProductIds(merged);
      setLastKey(merged.length ? merged[merged.length-1] : null);
      setHasMore(newIds.length === PAGE_SIZE);

      // fetch details for newIds
      const prodSnapPromises = newIds.map(id => get(ref(db, `/products/${id}`)));
      const prodSnaps = await Promise.all(prodSnapPromises);
      setProductsMap(prev => {
        const map = { ...prev };
        prodSnaps.forEach(s => { if(s.exists()) map[s.key] = s.val(); });
        return map;
      });
    }catch(e){
      console.error('Failed to load more category products', e);
    }finally{
      setLoadingMore(false);
    }
  };

  const loadedProducts = productIds.map(id => ({ id, ...productsMap[id] })).filter(Boolean);

  const filteredAndSortedProducts = useMemo(() => {
    if (!loadedProducts || !category) return [];
    let products = [...loadedProducts];

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
  }, [loadedProducts, searchTerm, sortBy, priceRange, filterInStock]);

  if (catLoading || loading) return <Loader />;
  if (!category) return <div className="text-center py-12">Category not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Category Header */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{category.name}</h1>
        {category.description && (
          <p className="text-gray-600 max-w-2xl mx-auto">{category.description}</p>
        )}
        <div className="flex items-center justify-center gap-4">
          <div className="text-sm text-gray-500">{filteredAndSortedProducts.length} products available</div>
          {(searchTerm || priceRange !== 'all' || filterInStock || sortBy !== 'name') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPriceRange('all');
                setFilterInStock(false);
                setSortBy('name');
              }}
              className="text-sm px-3 py-1 border rounded bg-white hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters - Swiggy style */}
      <div className="hidden md:block">
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
          onClearFilters={() => {
            setSearchTerm('');
            setPriceRange('all');
            setFilterInStock(false);
            setSortBy('name');
          }}
        />
      </div>

      {/* Mobile filter button */}
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
        onClearFilters={() => {
          setSearchTerm('');
          setPriceRange('all');
          setFilterInStock(false);
          setSortBy('name');
        }}
      />

      {/* Products Grid - Swiggy style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredAndSortedProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* No results state */}
      {filteredAndSortedProducts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No products found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setPriceRange('all');
              setFilterInStock(false);
              setSortBy('name');
            }}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Load More button */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
