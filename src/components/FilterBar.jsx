import React from 'react';

export default function FilterBar({ 
  searchTerm, 
  setSearchTerm, 
  sortBy, 
  setSortBy, 
  priceRange, 
  setPriceRange, 
  filterInStock, 
  setFilterInStock,
  resultCount,
  onClearFilters,
  // category filter props
  categories = {},
  selectedCategory = '',
  setSelectedCategory = () => {},
  showCategoryFilter = true,
  showPriceFilter = true,
  showStockFilter = true,
  searchPlaceholder = "Search...",
  vertical = false,
}) {
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'popular', label: 'Most Popular' }
  ];

  const priceOptions = [
    { value: 'all', label: 'All Prices' },
    { value: 'under50', label: 'Under ₹50' },
    { value: '50-100', label: '₹50 - ₹100' },
    { value: '100-200', label: '₹100 - ₹200' },
    { value: 'above200', label: 'Above ₹200' }
  ];

  // compute grid class depending on which filters are shown
  const gridClass = vertical
    ? 'grid gap-3 grid-cols-1'
    : (showCategoryFilter
      ? (showPriceFilter && showStockFilter ? 'grid gap-4 grid-cols-1 md:grid-cols-4' : 'grid gap-4 grid-cols-1 md:grid-cols-3')
      : (showPriceFilter && showStockFilter ? 'grid gap-4 grid-cols-1 md:grid-cols-3' : 'grid gap-4 grid-cols-1 md:grid-cols-2'));

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full p-2 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 11A4.65 4.65 0 1111 6.65 4.65 4.65 0 0116.65 11z" />
        </svg>
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Options */}
      <div className={gridClass}>
        {/* Category */}
        {showCategoryFilter && (
          <div>
            <label className={`block text-sm font-medium text-gray-700 ${vertical ? 'mb-1' : 'mb-2'}`}>Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${vertical ? 'py-2' : ''}`}
            >
              <option value="">All Categories</option>
              {Object.entries(categories).map(([cid, c]) => (
                <option key={cid} value={cid}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sort By */}
        <div>
          <label className={`block text-sm font-medium text-gray-700 ${vertical ? 'mb-1' : 'mb-2'}`}>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        {showPriceFilter && (
          <div>
            <label className={`block text-sm font-medium text-gray-700 ${vertical ? 'mb-1' : 'mb-2'}`}>Price Range</label>
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {priceOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stock Filter */}
        {showStockFilter && (
          <div className="flex items-center">
            <label className={`flex items-center gap-2 text-sm text-gray-700 ${vertical ? 'mt-2' : 'mt-6'}`}>
              <input
                type="checkbox"
                checked={filterInStock}
                onChange={(e) => setFilterInStock(e.target.checked)}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              In Stock Only
            </label>
          </div>
        )}
      </div>

      {/* Active Filters Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">
            {resultCount !== undefined ? `Showing ${resultCount} results` : ''}
          </span>
          {searchTerm && (
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
              Search: "{searchTerm}"
            </span>
          )}
          {showPriceFilter && priceRange !== 'all' && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
              Price: {priceOptions.find(p => p.value === priceRange)?.label}
            </span>
          )}
          {showStockFilter && filterInStock && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
              In Stock
            </span>
          )}
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || (showPriceFilter && priceRange !== 'all') || (showStockFilter && filterInStock)) && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  );
}
