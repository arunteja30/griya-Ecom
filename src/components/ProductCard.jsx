import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';

export default function ProductCard({ product }) {
  const { addToCart } = useContext(CartContext);

  return (
    <div className="border rounded overflow-hidden bg-white">
      <img src={normalizeImageUrl(product.images?.[0] || '/placeholder.jpg')} alt={product.name} className="w-full h-56 object-cover" />
      <div className="p-3">
        <div className="font-medium text-sm mb-1">{product.name}</div>
        <div className="text-gray-600 text-sm mb-2">₹{product.price}</div>
        <div className="flex items-center gap-2">
          <Link to={`/product/${product.slug}`} className="inline-block text-sm text-white bg-primary px-3 py-2 rounded">View Details</Link>
          <button onClick={() => { addToCart(product, 1); showToast('Added to cart'); }} className="inline-block text-sm bg-accent text-white px-3 py-2 rounded">Add to Cart</button>
        </div>
      </div>
    </div>
  );
}
