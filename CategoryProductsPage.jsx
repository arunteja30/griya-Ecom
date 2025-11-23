import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useCategoryBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);
  const { data: productsData, loading: prodLoading } = useFirebaseList("/products");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name"); // name, price-low, price-high

  if (catLoading || prodLoading) return <Loader />;
  if (!category) return <div>Category not found</div>;

  let products = productsData ? Object.values(productsData).filter((p) => p.categoryId === category.id) : [];
  
  // Filter by search
  if (searchTerm) {
    products = products.filter(p => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Sort products
  if (sortBy === "price-low") {
    products = [...products].sort((a, b) => (a.price || 0) - (b.price || 0));
  } else if (sortBy === "price-high") {
    products = [...products].sort((a, b) => (b.price || 0) - (a.price || 0));
  } else {
    products = [...products].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return (
    <div>
      <SectionTitle title={category.name} subtitle={category.description} />
      
      {/* Filters bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-600">Sort by:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="name">Name</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Products grid - Swiggy style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          No products found{searchTerm ? ` matching "${searchTerm}"` : ""}
        </div>
      )}
    </div>
  );
}
