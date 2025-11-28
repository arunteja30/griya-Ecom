import React from "react";
import { useParams } from "react-router-dom";
import { useRealtime } from "../hooks/useRealtime";

export default function Product() {
  const { id } = useParams();
  const { data: product, loading } = useRealtime(`/products/${id}`);

  if (loading) return <div>Loading...</div>;
  if (!product) return <div>Product not found</div>;

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <img src={product.image || '/placeholder.jpg'} alt={product.title} className="w-full h-96 object-cover rounded" />
      </div>
      <div>
        <h1 className="text-2xl font-bold mb-2">{product.title}</h1>
        <div className="text-xl text-gray-700 mb-4">₹{product.price}</div>
        <div className="prose mb-4">{product.description}</div>
        <button className="btn btn-primary">Add to cart</button>
      </div>
    </div>
  );
}
