import React, { useState, useContext, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useProductBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import { CartContext } from "../context/CartContext";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from "../utils/imageHelpers";
import Modal from "../components/Modal";

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const navigate = useNavigate();

  const { data: product, loading } = useProductBySlug(productSlug);
  const { data: allProducts } = useFirebaseList("/products");
  const { addToCart } = useContext(CartContext);

  // UI state
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);

  // Normalize products list
  const productsArray = allProducts && typeof allProducts === "object"
    ? Object.entries(allProducts).map(([k, v]) => ({ ...v, id: k }))
    : [];

  const prodCategory = product?.categoryId || product?.category || product?.categorySlug;

  // related products
  const related = useMemo(() => {
    if (!product) return [];
    return productsArray
      .filter((p) => (p.categoryId || p.category || p.categorySlug) === prodCategory && (p.id !== (product.id || product.slug)))
      .slice(0, 8);
  }, [productsArray, product, prodCategory]);

  if (loading) return <Loader />;
  if (!product) return <div className="py-12 text-center">Product not found</div>;

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const selectedVariant = variants[selectedVariantIndex] || {};

  const displayPrice = selectedVariant.price ?? product.price;
  const originalPrice = selectedVariant.originalPrice ?? product.originalPrice;
  const inStock = selectedVariant.inStock ?? product.inStock;

  const handleAdd = (openCart = false) => {
    addToCart({ ...product, variant: selectedVariant }, Number(qty) || 1);
    showToast("Added to cart");
    if (openCart) navigate("/cart");
  };

  const handleBuyNow = () => {
    addToCart({ ...product, variant: selectedVariant }, Number(qty) || 1);
    navigate("/checkout");
  };

  return (
    <div className="section-container py-8">
      <nav className="text-sm text-neutral-500 mb-4">
        <Link to="/" className="hover:underline">Home</Link>
        <span className="mx-2">/</span>
        <Link to={`/collections/${product.categorySlug || product.categoryId || ""}`} className="hover:underline">{product.categoryName || product.category || product.categoryId}</Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gallery */}
        <div className="lg:col-span-7">
          <div className="card overflow-hidden">
            <div className="w-full bg-neutral-100">
              <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                <img
                  src={normalizeImageUrl(product.images?.[selectedImage]) || "/placeholder.jpg"}
                  alt={product.name}
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxOpen(true)}
                />
              </div>

              <div className="mt-3 grid grid-cols-4 gap-3 p-4">
                {(product.images || []).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`overflow-hidden rounded border ${i === selectedImage ? 'ring-2 ring-primary-500' : 'border-transparent'}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={normalizeImageUrl(img) || '/placeholder.jpg'} className="w-full h-20 object-cover" alt={`thumb-${i}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Details panel */}
        <div className="lg:col-span-5">
          <div className="space-y-4">
            <h1 className="text-2xl md:text-3xl font-bold text-primary-900">{product.name}</h1>

            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-primary-900">₹{displayPrice}</div>
              {originalPrice && originalPrice > displayPrice && (
                <div className="text-sm text-neutral-500 line-through">₹{originalPrice}</div>
              )}
            </div>

            {product.shortDescription && <p className="text-neutral-600">{product.shortDescription}</p>}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="mt-2">
                <div className="text-sm text-neutral-600 mb-2">Options</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedVariantIndex(i)}
                      className={`px-3 py-2 border rounded text-sm ${i === selectedVariantIndex ? 'bg-primary-50 border-primary-300' : 'bg-white'}`}
                    >
                      {v.label || v.name || `Option ${i + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity & actions */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center border rounded overflow-hidden">
                <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, Number(q) - 1))}>-</button>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="w-16 text-center" />
                <button className="px-3 py-2" onClick={() => setQty((q) => Number(q) + 1)}>+</button>
              </div>

              <div className="flex items-center gap-2">
                <button disabled={!inStock} onClick={() => handleAdd(false)} className={`btn btn-primary px-5 ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}>Add to Cart</button>
                <button disabled={!inStock} onClick={() => handleBuyNow()} className={`btn btn-accent px-5 ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}>Buy Now</button>
              </div>
            </div>

            {!inStock && <div className="text-sm text-error">Currently out of stock</div>}

            {/* Meta */}
            <div className="text-sm text-neutral-500 mt-4">
              <div>SKU: {product.sku || product.id}</div>
              {product.brand && <div>Brand: {product.brand}</div>}
            </div>

            {/* Tabs */}
            <div className="mt-6">
              <div className="flex items-center gap-2 border-b border-neutral-200">
                <button onClick={() => setActiveTab('description')} className={`px-4 py-3 ${activeTab === 'description' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-neutral-600'}`}>Description</button>
                <button onClick={() => setActiveTab('details')} className={`px-4 py-3 ${activeTab === 'details' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-neutral-600'}`}>Details</button>
                <button onClick={() => setActiveTab('reviews')} className={`px-4 py-3 ${activeTab === 'reviews' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-neutral-600'}`}>Reviews</button>
              </div>

              <div className="p-4 bg-white border rounded-b mt-2">
                {activeTab === 'description' && (
                  <div className="prose text-neutral-700">{product.description || product.longDescription || 'No description available.'}</div>
                )}

                {activeTab === 'details' && (
                  <div className="text-sm text-neutral-700 grid grid-cols-1 gap-2">
                    {product.materials && <div><strong>Material:</strong> {product.materials}</div>}
                    {product.weight && <div><strong>Weight:</strong> {product.weight}</div>}
                    {product.dimensions && <div><strong>Dimensions:</strong> {product.dimensions}</div>}
                    {product.manufacturer && <div><strong>Manufacturer:</strong> {product.manufacturer}</div>}
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div>
                    {product.reviews && product.reviews.length > 0 ? (
                      product.reviews.map((r, i) => (
                        <div key={i} className="border-b py-2">
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-sm text-neutral-600">{r.comment}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-neutral-500">No reviews yet.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="lg:col-span-12 mt-8">
            <h3 className="text-xl font-semibold mb-4">Related products</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </div>
        )}
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
