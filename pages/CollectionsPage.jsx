import React, { useState, useMemo } from "react";
import { useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { Link } from "react-router-dom";
import FilterBar from "../components/FilterBar";

export default function CollectionsPage() {
  const { data: categories, loading } = useFirebaseList("/categories");
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const filteredAndSortedCategories = useMemo(() => {
    if (!categories) return [];
    
    let cats = Object.values(categories);
    
    // Filter by search term
    if (searchTerm) {
      cats = cats.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Sort categories
    cats.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'popular':
          return (b.productCount || 0) - (a.productCount || 0);
        default:
          return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
    });
    
    return cats;
  }, [categories, searchTerm, sortBy]);

  if (loading) return <Loader />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Shop by Category
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Browse our wide selection of fresh groceries and daily essentials
        </p>
      </div>
      

      {/* Categories Grid - compact for mobile: 4 columns on small screens */}
      <div className="grid grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-2">
        {filteredAndSortedCategories.map((c) => (
          <Link
            key={c.id}
            to={`/category/${c.slug || c.id}`}
            className="group bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 aspect-square">
              <img 
                src={c.thumbnail || c.image || '/placeholder.jpg'} 
                alt={c.name} 
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
              
              {/* Product count badge - hidden on very small screens */}
              {c.productCount && (
                <div className="hidden sm:block absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {c.productCount} items
                </div>
              )}
            </div>
            
            <div className="p-1">
              <div className="text-[12px] text-center text-gray-800 font-medium group-hover:text-orange-600 transition-colors duration-150 line-clamp-2">
                 {c.name}
               </div>
             </div>
           </Link>
         ))}
       </div>

      
    </div>
  );
}
