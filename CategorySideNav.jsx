import React, { useState } from 'react';
import FilterBar from './FilterBar';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';

export default function CategorySideNav({
  categories = {},
  selectedCategory,
  selectedSubcategory,
  setSelectedCategory,
  setSelectedSubcategory,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  priceRange,
  setPriceRange,
  filterInStock,
  setFilterInStock,
  resultCount,
  onClearFilters
}) {
  const [fetchedSubcats, setFetchedSubcats] = useState({});

  const fetchSubcategoriesFor = async (cid) => {
    try {
      const snap = await get(ref(db, `/categories/${cid}/subcategories`));
      const val = snap.exists() ? snap.val() : null;
      let subs = [];
      if (val) {
        if (Array.isArray(val)) subs = val;
        else if (typeof val === 'object') {
          // object keyed by id -> value
          subs = Object.entries(val).map(([k, v]) => ({ id: k, ...v }));
        }
      }
      setFetchedSubcats(prev => ({ ...prev, [cid]: subs }));
      return subs;
    } catch (e) {
      console.error('Failed to fetch subcategories for', cid, e);
      return [];
    }
  };

  return (
    <div className="sticky top-28 h-[calc(100vh-7rem)] overflow-auto pr-2">
      <div className="bg-white rounded-md border border-gray-100 overflow-hidden">
        <div className="p-3">
          <h4 className="text-sm font-semibold mb-3">Categories</h4>
          <nav className="flex flex-col gap-2 text-sm">
            {Object.entries(categories).map(([cid, c]) => {
              const img = c.image || c.icon || '/placeholder.jpg';
              const localSubcats = Array.isArray(c.subcategories) ? c.subcategories : (fetchedSubcats[cid] || []);
              return (
                <div key={cid}>
                  <button
                    onClick={async () => {
                      setSelectedCategory(cid);
                      setSelectedSubcategory('');
                      // fetch subcategories if not present
                      if (!Array.isArray(c.subcategories) && !fetchedSubcats[cid]) {
                        await fetchSubcategoriesFor(cid);
                      }
                    }}
                    className={`w-full flex flex-col items-center gap-2 px-2 py-3 rounded ${selectedCategory === cid && !selectedSubcategory ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <img src={img} alt={c.name} className="w-14 h-14 rounded-md object-cover mb-1" />
                    <span className="text-sm text-center truncate">{c.name}</span>
                  </button>

                  {/* render subcategories if this category is active */}
                  {selectedCategory === cid && localSubcats && localSubcats.length > 0 && (
                    <div className="pl-3 mt-1 flex flex-col gap-1">
                      {localSubcats.map((sub) => {
                        const subId = sub?.id || sub?.slug || sub?.key || sub;
                        const subName = sub?.name || sub?.title || String(subId);
                        return (
                          <button
                            key={subId}
                            onClick={() => { setSelectedSubcategory(subId); setSelectedCategory(cid); }}
                            className={`block w-full text-left px-2 py-1 rounded text-sm ${selectedSubcategory === subId ? 'bg-orange-100 text-orange-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {subName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t px-3 py-3">
          <h4 className="text-sm font-semibold mb-2">Filters</h4>
          <FilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            priceRange={priceRange}
            setPriceRange={setPriceRange}
            filterInStock={filterInStock}
            setFilterInStock={setFilterInStock}
            resultCount={resultCount}
            onClearFilters={onClearFilters}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={(id) => { setSelectedCategory(id); setSelectedSubcategory(''); }}
            vertical={true}
          />
        </div>
      </div>
    </div>
  );
}
