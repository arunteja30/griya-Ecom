import React, { useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { useProductBySlug, useFirebaseList } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import { CartContext } from "../context/CartContext";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import Modal from "../components/Modal";
import ProductCard from "../components/ProductCard";

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const { data: product, loading } = useProductBySlug(productSlug);
  const { data: allProducts } = useFirebaseList("/products");
  const { addToCart } = useContext(CartContext);
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (loading) return <Loader />;
  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Product Not Found</h1>
        <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
        <Link to="/groceries" className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
          Browse Products
        </Link>
      </div>
    );
  }

  // Build products array including each item's key as `id` so we can compare properly
  const productsArray = allProducts ? Object.entries(allProducts).map(([k, v]) => ({ ...v, id: k })) : [];
  const prodCategory = product.categoryId || product.category || product.categorySlug;
  const related = productsArray
    .filter((p) => (p.categoryId || p.category || p.categorySlug) === prodCategory && p.id !== (product.id || product.slug))
    .slice(0, 6);

  const handleAdd = () => {
    addToCart(product, Number(qty) || 1);
    showToast('Added to cart!', 'success');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Product Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Images */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <img
              src={normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'}
              alt={product.name}
              className="w-full aspect-square object-cover cursor-zoom-in hover:scale-105 transition-transform duration-300"
              onClick={() => setLightboxOpen(true)}
            />
          </div>

          {product.images && product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                    i === selectedImage ? 'border-orange-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img 
                    src={normalizeImageUrl(img)} 
                    className="w-20 h-20 object-cover" 
                    alt={`${product.name} ${i + 1}`} 
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 leading-tight">
              {product.name}
            </h1>
            
            {product.rating && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded text-sm font-medium">
                  <span>★</span>
                  <span>{product.rating}</span>
                </div>
                {product.reviewCount && (
                  <span className="text-gray-500 text-sm">({product.reviewCount} reviews)</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl lg:text-3xl font-bold text-gray-800">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>
            
            {product.discount && (
              <div className="text-green-600 font-medium text-sm">
                You save {formatPrice(product.originalPrice - product.price)} ({product.discount}% off)
              </div>
            )}
          </div>

          {product.description && (
            <div className="prose prose-sm text-gray-700">
              <p>{product.description}</p>
            </div>
          )}

          {/* Add to Cart Section */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-white rounded-lg border border-gray-200">
                <button 
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="p-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <input 
                  type="number" 
                  value={qty} 
                  min={1} 
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} 
                  className="w-16 text-center border-0 bg-transparent font-medium focus:outline-none"
                />
                <button 
                  onClick={() => setQty(qty + 1)}
                  className="p-3 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              
              <button 
                onClick={handleAdd}
                disabled={!product.inStock}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
                </svg>
                {product.inStock ? 'Add to Cart' : 'Out of Stock'}
              </button>
            </div>
            
            {!product.inStock && (
              <p className="text-red-600 text-sm">This item is currently out of stock.</p>
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">You May Also Like</h2>
            <Link 
              to="/groceries" 
              className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1"
            >
              View More
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {related.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox modal for larger image view */}
      <Modal isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} hideActions>
        <div className="max-w-4xl mx-auto">
          <img 
            src={normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'} 
            alt={product.name} 
            className="w-full h-auto object-contain rounded-lg" 
          />
        </div>
      </Modal>
    </div>
  );
}
