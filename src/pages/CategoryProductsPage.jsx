import React from "react";
import { useParams } from "react-router-dom";
import { useCategoryBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import SectionTitle from "../components/SectionTitle";

export default function CategoryProductsPage() {
  const { categorySlug } = useParams();
  const { data: category, loading: catLoading } = useCategoryBySlug(categorySlug);
  const { data: productsData, loading: prodLoading } = useFirebaseList("/products");

  if (catLoading || prodLoading) return <Loader />;
  if (!category) return <div>Category not found</div>;

  const products = productsData ? Object.values(productsData).filter((p) => p.categoryId === category.id) : [];

  return (
    <div>
      <SectionTitle title={category.name} subtitle={category.description} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
