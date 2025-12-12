import React, { useState, useContext, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useProductBySlug, useFirebaseList } from "../hooks/useFirebase";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import { CartContext } from "../context/CartContext";
import { showToast } from "../components/Toast";
import { normalizeImageUrl } from "../utils/imageHelpers";
import Modal from "../components/Modal";
import UniversalImage from "../components/UniversalImage";

export default function ProductDetailPage() {
  const { productSlug } = useParams();
  const navigate = useNavigate();

  const { data: product, loading } = useProductBySlug(productSlug);
  const { data: allProducts } = useFirebaseList("/products");
  const { data: allReviews } = useFirebaseList("/reviews");
  const { addToCart, cartItems } = useContext(CartContext);

  // UI state
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  // Zoom state for main image
  const [isZoomActive, setIsZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  // Normalize products list
  const productsArray = allProducts && typeof allProducts === "object"
    ? Object.entries(allProducts).map(([k, v]) => ({ ...v, id: k }))
    : [];

  const prodCategory = product?.categoryId || product?.category || product?.categorySlug;

  // Reviews: normalize and filter for this product (only enabled)
  const reviewsArray = allReviews && typeof allReviews === 'object'
    ? Object.entries(allReviews).map(([k, v]) => ({ id: k, ...v }))
    : [];
  const productIdKey = product?.id || product?.slug || null;
  const productReviews = reviewsArray
    .filter(r => r && (r.enabled === undefined || r.enabled === true) && (r.productId === productIdKey))
    .sort((a,b)=> (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
  const reviewCount = productReviews.length;
  const computedAvgRating = reviewCount > 0
    ? Math.round((productReviews.reduce((s,r)=> s + (Number(r.rating)||0),0) / reviewCount) * 10) / 10
    : (product?.avgRating || 0);

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
    const qtyInt = Math.max(1, Math.floor(Number(qty) || 1));

    // If we have a finite availableStock, ensure existing+requested doesn't exceed it
    if (availableStock > 0) {
      const pid = (product.id || product.slug || product.sku || product.name);
      const existing = (cartItems || []).find(i => String(i.id) === String(pid));
      const existingQty = existing ? Number(existing.quantity || 0) : 0;

      if (existingQty >= availableStock) {
        setQtyError('No more stock available');
        showToast('No more stock available', 'error');
        return;
      }

      const remaining = availableStock - existingQty;
      const toAdd = Math.min(qtyInt, remaining);
      if (toAdd <= 0) {
        setQtyError('No more stock available');
        showToast('No more stock available', 'error');
        return;
      }

      addToCart({ ...product, variant: selectedVariant }, toAdd);
      setQtyError(null);
      showToast(`Added ${toAdd} to cart`, 'success');
      if (openCart) navigate('/cart');
      return;
    }

    // No finite stock info -> allow add
    const toAdd = qtyInt;
    addToCart({ ...product, variant: selectedVariant }, toAdd);
    setQtyError(null);
    showToast(`Added ${toAdd} to cart`, 'success');
    if (openCart) navigate('/cart');
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
            <div className="w-full bg-neutral-100 relative">
              {/* Main image area: click to open lightbox, hover to preview zoom (desktop) */}
              <div
                className="aspect-[4/3] bg-neutral-100 overflow-hidden relative cursor-zoom-in"
                onMouseEnter={(e) => { if (window.innerWidth >= 768) setIsZoomActive(true); }}
                onMouseMove={(e) => {
                  if (!isZoomActive) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomPos({ x, y });
                }}
                onMouseLeave={() => setIsZoomActive(false)}
                onClick={() => setLightboxOpen(true)}
              >
                <UniversalImage
                  src={normalizeImageUrl(product.images?.[selectedImage]) || "/placeholder.jpg"}
                  alt={product.name}
                  className="w-full h-full object-contain object-center"
                  placeholder={normalizeImageUrl(product.images?.[0])}
                  fallback={'/placeholder.jpg'}
                />

                {/* Zoom pane (desktop only) */}
                <div
                  className={`hidden md:block pointer-events-none absolute top-3 right-3 w-40 h-40 rounded overflow-hidden shadow-lg border`} 
                  style={{
                    backgroundImage: `url(${normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                    backgroundSize: isZoomActive ? '220%' : '100%'
                  }}
                />
              </div>

              {/* Thumbnails */}
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-3 p-4">
                {(product.images || []).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedImage(i); setIsZoomActive(false); }}
                    className={`overflow-hidden rounded border ${i === selectedImage ? 'ring-2 ring-primary-500' : 'border-transparent'}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <UniversalImage src={normalizeImageUrl(img) || '/placeholder.jpg'} className="w-full h-20 object-contain" alt={`thumb-${i}`} fallback={'/placeholder.jpg'} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Details panel */}
        <div className="lg:col-span-5">
          <div className="space-y-4">
            {/* Make details sticky on large screens for easier add-to-cart access */}
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="flex items-center gap-3">
                <Link to={`/collections/${product.categorySlug || product.categoryId || ''}`} aria-label="Back to collections" title="Back" className="p-2 rounded-full bg-primary-600 text-white shadow-md inline-flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold text-primary-900">{product.name}</h1>
              </div>

              {/** Use computedAvgRating and reviewCount when available **/}
              { (computedAvgRating || reviewCount > 0) && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center text-yellow-500" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className={i < Math.round(computedAvgRating) ? '' : 'opacity-30'}>★</span>
                    ))}
                  </div>
                  <div className="text-sm text-neutral-600">{(computedAvgRating || 0).toFixed(1)} · {reviewCount} reviews</div>
                </div>
              )}

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
                  <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, Math.floor(Number(q) || 1) - 1))}>-</button>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    pattern="\d*"
                    aria-label="Quantity"
                    value={qty}
                    onKeyDown={(e) => { if (['e','E','+','-','.'].includes(e.key)) e.preventDefault(); }}
                    onPaste={(e) => { const paste = (e.clipboardData.getData('text')||'').replace(/\D/g,''); if (!paste) e.preventDefault(); }}
                    onChange={(e) => {
                      const raw = String(e.target.value || '');
                      // strip non-digits
                      const digits = raw.replace(/\D/g, '');
                      const n = Math.max(1, Math.floor(Number(digits) || 1));
                      setQty(n);
                    }}
                    className="w-20 text-center border rounded px-2 py-1 bg-white"
                  />
                  <button className="px-3 py-2" onClick={() => setQty((q) => Math.max(1, Math.floor(Number(q) || 1) + 1))}>+</button>
                </div>

                <div className="flex items-center gap-2">
                  <button disabled={!inStock} onClick={() => handleAdd(false)} className={`btn btn-primary px-5 ${!inStock ? 'opacity-50 cursor-not-allowed' : ''}`}>Add to Cart</button>
                </div>
              </div>

              {!inStock && <div className="text-sm text-error">Currently out of stock</div>}

              {/* Meta */}
              {product.brand && (
                <div className="text-sm text-neutral-500 mt-4">
                  <div>Brand: {product.brand}</div>
                </div>
              )}

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
                      {productReviews && productReviews.length > 0 ? (
                        productReviews.map((r) => (
                          <div key={r.id} className="border-b py-2">
                            <div className="font-semibold">{r.name} <span className="text-sm text-neutral-500">{r.rating}★</span></div>
                            <div className="text-sm text-neutral-600">{r.message}</div>
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
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="lg:col-span-12 mt-8">
            <h3 className="text-xl font-semibold mb-4">Related products</h3>
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                {related.map((r) => (
                  <div key={r.id} className="flex-shrink-0 w-[160px] sm:w-[200px] md:w-[240px] lg:w-[260px] snap-start">
                    <ProductCard product={r} />
                  </div>
                ))}
              </div>

              {/* subtle fade to indicate more items */}
              <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none hidden sm:block" />
            </div>
          </div>
        )}
      </div>

      {/* Lightbox modal for larger image view */}
      <Modal isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} hideActions>
        <div className="max-w-4xl mx-auto">
          <UniversalImage src={normalizeImageUrl(product.images?.[selectedImage]) || '/placeholder.jpg'} alt={product.name} className="w-full h-auto object-contain" fallback={'/placeholder.jpg'} />
        </div>
      </Modal>
    </div>
  );
}
