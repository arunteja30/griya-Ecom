import React, { useContext, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CartContext } from "../context/CartContext";
import { showToast } from "./Toast";
import { normalizeImageUrl } from '../utils/imageHelpers';
import BottomSheet from './BottomSheet';
import { useSiteSettings } from '../hooks/useRealtime';

export default function ProductCard({ product }) {
  const { addToCart } = useContext(CartContext);
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBottomOpen, setIsBottomOpen] = useState(false);

  // normalize variants to an array so frontend works with both shapes
  const variants = Array.isArray(product.variants)
    ? product.variants
    : (product.variants ? Object.values(product.variants) : []);

  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (variants && variants.length) {
      // keep previous selection if possible, otherwise pick first
      setSelectedVariant(prev => {
        if (prev) {
          const found = variants.find(v => v.id === prev.id);
          if (found) return found;
        }
        return variants[0];
      });
    } else {
      setSelectedVariant(null);
    }
  }, [product.variants]);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      // construct a variant-aware product object for the cart
      const baseId = product.id || product.slug || product.name;
      const itemForCart = {
        ...product,
        id: selectedVariant ? `${baseId}-${selectedVariant.id}` : baseId,
        variantId: selectedVariant?.id,
        variantLabel: selectedVariant?.label,
        price: selectedVariant ? Number(selectedVariant.price) : Number(product.price),
        originalPrice: selectedVariant && selectedVariant.price && product.originalPrice ? Number(product.originalPrice) : product.originalPrice,
      };
      await addToCart(itemForCart, 1);
      showToast('Added to cart successfully!', 'success');
    } catch (error) {
      showToast('Failed to add to cart', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const { data: settings } = useSiteSettings();
  const theme = settings?.theme || {};
  const cardStyle = {
    background: theme.productCardBgColor || undefined,
    color: theme.cardTextColor || undefined,
    borderColor: theme.cardBorderColor || undefined,
  };
  const primaryBtnBg = theme.cardButtonPrimaryBg || theme.primaryColor;
  const primaryBtnText = theme.cardButtonPrimaryTextColor || '#ffffff';
  const accentBtnBg = theme.cardButtonAccentBg || theme.accentColor;
  const accentBtnText = theme.cardButtonAccentTextColor || '#ffffff';
  const badgeBg = theme.cardBadgeBgColor || '#16a34a';
  const itemTextColor = theme.cardTextColor || undefined;
  const priceColor = theme.accentColor || theme.primaryColor || undefined;

  return (
    <div 
      className="relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group"
      style={{ background: cardStyle.background, color: cardStyle.color, border: `1px solid ${cardStyle.borderColor || 'transparent'}` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Product Image Container - Exact Swiggy Instamart Style */}
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        <img 
          src={normalizeImageUrl(product.images?.[0] || '/placeholder.jpg')} 
          alt={product.name} 
          className="w-full h-full object-cover"
        />
        
        {/* Discount Badge - Top Left Corner with rounded corners */}
        {product.discount && product.discount > 0 && product.inStock && (
          <div className="absolute top-2 left-0 text-white text-xs font-bold px-2 py-1 rounded-md" style={{ background: badgeBg }}>
            {product.discount}% OFF
          </div>
        )}

        {/* Add Button - Top Right Corner - Blue circle with plus */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (isLoading || !product.inStock) return;

            // If product has variants, prefer the selectedVariant (or fallback to first)
            if (variants && variants.length) {
              setIsLoading(true);
              try {
                const v = selectedVariant || variants[0];
                const baseId = product.id || product.slug || product.name;
                const itemForCart = {
                  ...product,
                  id: v ? `${baseId}-${v.id}` : baseId,
                  variantId: v?.id,
                  variantLabel: v?.label,
                  price: v ? Number(v.price) : Number(product.price),
                  originalPrice:
                    v && v.price && product.originalPrice
                      ? Number(product.originalPrice)
                      : product.originalPrice,
                };
                await addToCart(itemForCart, 1);
                showToast('Added to cart successfully!', 'success');
                setIsBottomOpen(false);
              } catch (error) {
                showToast('Failed to add to cart', 'error');
              } finally {
                setIsLoading(false);
              }
            } else {
              // No variants — fallback to existing handler
              handleAddToCart();
            }
            }}
            disabled={isLoading || !product.inStock}
            className={`absolute top-0 right-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 ${
            isLoading || !product.inStock ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
            style={{ background: primaryBtnBg, color: primaryBtnText }}
          >
            {isLoading ? '•••' : '+'}
          </button>

          {/* Out of Stock Overlay */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="w-full bg-red-600 text-white rounded text-sm font-small flex items-center justify-center">
               Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Delivery Time - Below Image */}
      <div className="px-3 pt-2">
       {/* Product Name */}
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1 transition-colors" style={{ color: itemTextColor }}>
            {product.name}
          </h3>
        </Link>
      </div>

      <div className="px-3 pt-0.5">
        <span className="text-xs line-clamp-2 top-0 left-0 font-medium text-gray-500">
          {product.description ? `${product.description} ` : ' '}
        </span>
      </div>

      {/* Product Details */}
        <div className="px-3 pb-3 pt-1 text-left">

          {/* Unit/Size - opens bottom sheet when variants exist */}

           {variants && variants.length ? (
          <div className="flex items-center mb-2">
            <button onClick={() => setIsBottomOpen(true)} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded flex items-center justify-start">
          <span className="truncate">{selectedVariant ? `${selectedVariant.label} ${selectedVariant.unit || ''}` : (product.unit || '1 kg')}</span>
          <svg className="w-3 h-3 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
            </button>
          </div>
           ) : product.unit ? (
            <div className="flex items-center mb-2">
          <span className="text-xs text-gray-600">{product.unit}</span>
            </div>
          ) : null}

          {/* Price Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold" style={{ color: priceColor }}>
              {selectedVariant ? formatPrice(selectedVariant.price) : `₹${product.price}`}
            </span>
            {product.originalPrice && product.originalPrice > (selectedVariant ? selectedVariant.price : product.price) && (
              <span className="text-sm line-through" style={{ color: itemTextColor, opacity: 0.7 }}>
                ₹{product.originalPrice}
              </span>
            )}
          </div>
        </div>
      </div>

      <BottomSheet isOpen={isBottomOpen} onClose={() => setIsBottomOpen(false)} title={product.name}>
        <div className="space-y-2 shadow-md">
          {variants && variants.length ? variants.map(v => (
            <div key={v.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="font-medium">{v.label} {v.unit || ''}</div>
             
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">{formatPrice(v.price)}</div>
                {/* <button onClick={() => { setSelectedVariant(v); setIsBottomOpen(false); }}  */}

                 <button onClick={async (e) => {
                   setSelectedVariant(v);
                   setIsBottomOpen(false);
                   e.stopPropagation();
                   if (isLoading || !product.inStock) return;
                   console.log('Selected variant:', v?.price);

            // If product has variants, prefer the selectedVariant (or fallback to first)
            if (variants && variants.length) {
              setIsLoading(true);
              try {
                const baseId = product.id || product.slug || product.name;
                const itemForCart = {
                  ...product,
                  id: v ? `${baseId}-${v.id}` : baseId,
                  variantId: v?.id,
                  variantLabel: v?.label,
                  price: v ? Number(v.price) : Number(product.price),
                  unit: v?.label + v?.unit || product.unit
                };
              
                await addToCart(itemForCart, 1);
                showToast('Added to cart successfully!', 'success');
                setIsBottomOpen(false);
              } catch (error) {
                showToast('Failed to add to cart', 'error');
              } finally {
                setIsLoading(false);
              }
            } else {
              // No variants — fallback to existing handler
              console.log('No variants available, falling back to default handler');
              handleAddToCart();
            }
          }}
                className="px-3 py-1 rounded"
                style={{ background: accentBtnBg, color: accentBtnText }}
                >Select</button>
              </div>
            </div>
          )) : (
            <div className="text-sm" style={{ color: itemTextColor }}>No variants available</div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}