import React, { useState, useMemo } from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import FilterBar from "../components/FilterBar";

export default function AllProductsPage() {
  const { data: productsData, loading } = useFirebaseList("/products");

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [priceRange, setPriceRange] = useState('all');
  const [filterInStock, setFilterInStock] = useState(false);

  const filteredAndSortedProducts = useMemo(() => {
    if (!productsData) return [];
    let products = Object.entries(productsData).map(([k, v]) => ({ ...v, id: k }));

    if (searchTerm) {
      products = products.filter(p =>
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (filterInStock) {
      products = products.filter(p => p.inStock !== false);
    }

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
        case 'name': return a.name.localeCompare(b.name);
        case 'price-low': return (a.price || 0) - (b.price || 0);
        case 'price-high': return (b.price || 0) - (a.price || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'popular': return (b.orderCount || 0) - (a.orderCount || 0);
        default: return 0;
      }
    });

    return products;
  }, [productsData, searchTerm, sortBy, priceRange, filterInStock]);

  if (loading) return <Loader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">All Products</h1>
        <p className="text-gray-600">Browse everything we offer</p>
      </div>

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
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
    </div>
  );
}
