import React, { useState, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { useProductBySlug, useFirebaseList } from "../hooks/useFirebase";
import Loader from "../components/Loader";
import { CartContext } from "../context/CartContext";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import Modal from "../components/Modal";

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const { data: product, loading } = useProductBySlug(productSlug);
  const { data: allProducts } = useFirebaseList("/products");
  const { addToCart } = useContext(CartContext);
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (loading) return <Loader />;
  if (!product) return <div>Product not found</div>;

  // Build products array including each item's key as `id` so we can compare properly
  const productsArray = allProducts ? Object.entries(allProducts).map(([k, v]) => ({ ...v, id: k })) : [];
  const prodCategory = product.categoryId || product.category || product.categorySlug;
  const related = productsArray
    .filter((p) => (p.categoryId || p.category || p.categorySlug) === prodCategory && p.id !== (product.id || product.slug))
    .slice(0, 4);

  const handleAdd = () => {
    addToCart(product, Number(qty) || 1);
    showToast('Added to cart');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16">
      <div className="space-y-4">
        <div className="aspect-[4/3] bg-gray-100 rounded overflow-hidden group">
          <img
            src={normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'}
            alt={product.name}
            className="w-full h-full object-cover product-image cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          />
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          {product.images?.map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedImage(i)}
              className={`overflow-hidden rounded focus:outline-none ${i === selectedImage ? 'ring-2 ring-primary-500' : ''}`}
              aria-label={`View image ${i + 1}`}
            >
              <img src={normalizeImageUrl(img)} className="w-full h-20 object-cover rounded" alt={`thumb-${i}`} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <div className="text-2xl text-gray-700 mt-3">₹{product.price}</div>
        <div className="prose mt-6 text-gray-700">{product.description}</div>

        <div className="mt-6 flex items-center gap-3">
          <input type="number" value={qty} min={1} onChange={(e)=>setQty(e.target.value)} className="w-24 border p-2" />
          <button onClick={handleAdd} className="btn btn-primary inline-flex items-center px-6 py-3">Add to Cart</button>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold mb-2">Related products</h3>
          <div className="grid grid-cols-2 gap-4">
            {related.map((r) => (
              <Link
                key={r.id}
                to={`/product/${r.slug}`}
                className="card overflow-hidden hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-full h-32 bg-neutral-100 overflow-hidden">
                  <img src={normalizeImageUrl(r.images?.[0]) || '/placeholder.jpg'} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 text-sm text-primary-900">{r.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox modal for larger image view */}
      <Modal isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} hideActions>
        <div className="max-w-4xl mx-auto">
          <img src={normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'} alt={product.name} className="w-full h-auto object-contain" />
        </div>
      </Modal>
    </div>
  );
}
