import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { normalizeImageUrl } from '../utils/imageHelpers';
import Modal from './Modal';

const ImagePicker = ({ isOpen, onClose, onSelect, selectedUrl }) => {
  const [gallery, setGallery] = useState({});
  const [products, setProducts] = useState({});
  const [categories, setCategories] = useState({});
  const [merchantProducts, setMerchantProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('gallery');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    
    let loadingCount = 4;
    const checkAllLoaded = () => {
      loadingCount--;
      if (loadingCount === 0) {
        setLoading(false);
      }
    };

    // Load gallery
    const galleryRef = ref(db, '/gallery');
    const galleryUnsubscribe = onValue(galleryRef, snap => {
      setGallery(snap.val() || {});
      checkAllLoaded();
    });

    // Load products
    const productsRef = ref(db, '/products');
    const productsUnsubscribe = onValue(productsRef, snap => {
      setProducts(snap.val() || {});
      checkAllLoaded();
    });

    // Load categories
    const categoriesRef = ref(db, '/categories');
    const categoriesUnsubscribe = onValue(categoriesRef, snap => {
      setCategories(snap.val() || {});
      checkAllLoaded();
    });

    // Load merchant products
    const merchantProductsRef = ref(db, '/merchantProducts');
    const merchantProductsUnsubscribe = onValue(merchantProductsRef, snap => {
      setMerchantProducts(snap.val() || {});
      checkAllLoaded();
    });

    return () => {
      galleryUnsubscribe();
      productsUnsubscribe();
      categoriesUnsubscribe();
      merchantProductsUnsubscribe();
    };
  }, [isOpen]);

  const allImages = useMemo(() => {
    const images = [];
    
    // Gallery images
    Object.entries(gallery).forEach(([id, item]) => {
      if (item.url) {
        images.push({
          url: item.url,
          name: 'Gallery Image',
          type: 'Gallery',
          source: 'Gallery'
        });
      }
    });
    
    // Category images
    Object.entries(categories).forEach(([id, category]) => {
      if (category.image) {
        images.push({
          url: category.image,
          name: category.name,
          type: 'Category',
          source: `Category: ${category.name}`
        });
      }
    });
    
    // Product images (avoid duplicates)
    Object.entries(products).forEach(([id, product]) => {
      const uniqueUrls = new Set();
      
      if (product.imageUrl && !uniqueUrls.has(product.imageUrl)) {
        uniqueUrls.add(product.imageUrl);
        images.push({
          url: product.imageUrl,
          name: product.name,
          type: 'Product',
          source: `Product: ${product.name}`
        });
      }
      
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img, index) => {
          if (img && !uniqueUrls.has(img)) {
            uniqueUrls.add(img);
            images.push({
              url: img,
              name: product.name,
              type: 'Product',
              source: `Product: ${product.name} (${index + 1})`
            });
          }
        });
      }
    });
    
    // Merchant product images
    Object.entries(merchantProducts).forEach(([merchantId, merchantProductList]) => {
      Object.entries(merchantProductList || {}).forEach(([productId, product]) => {
        const uniqueUrls = new Set();
        
        if (product.imageUrl && !uniqueUrls.has(product.imageUrl)) {
          uniqueUrls.add(product.imageUrl);
          images.push({
            url: product.imageUrl,
            name: product.name,
            type: 'Merchant Product',
            source: `Merchant: ${product.name}`
          });
        }
        
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img, index) => {
            if (img && !uniqueUrls.has(img)) {
              uniqueUrls.add(img);
              images.push({
                url: img,
                name: product.name,
                type: 'Merchant Product',
                source: `Merchant: ${product.name} (${index + 1})`
              });
            }
          });
        }
      });
    });
    
    // Remove global duplicates
    const uniqueImages = images.filter((image, index, self) => 
      index === self.findIndex(img => img.url === image.url)
    );
    
    return uniqueImages;
  }, [gallery, categories, products, merchantProducts]);

  const filteredImages = useMemo(() => {
    let filtered = allImages;
    
    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(img => 
        img.type.toLowerCase() === activeTab.toLowerCase()
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img => 
        img.name.toLowerCase().includes(query) ||
        img.source.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allImages, activeTab, searchQuery]);

  const galleryCount = Object.keys(gallery).length;
  const categoryCount = allImages.filter(img => img.type === 'Category').length;
  const productCount = allImages.filter(img => img.type === 'Product').length;
  const merchantProductCount = allImages.filter(img => img.type === 'Merchant Product').length;

  const handleImageSelect = (imageUrl) => {
    onSelect(imageUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Select Image from Gallery"
      hideActions
      size="large"
    >
      <div className="max-h-[80vh] flex flex-col">
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              All ({allImages.length})
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'gallery'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Gallery ({galleryCount})
            </button>
            <button
              onClick={() => setActiveTab('category')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'category'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Categories ({categoryCount})
            </button>
            <button
              onClick={() => setActiveTab('product')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'product'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Products ({productCount})
            </button>
            <button
              onClick={() => setActiveTab('merchant product')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'merchant product'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Merchant ({merchantProductCount})
            </button>
          </nav>
        </div>

        {/* Images Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading images...</div>
            </div>
          ) : (
            <>
              {filteredImages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {searchQuery ? 'No images found matching your search.' : 'No images available.'}
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filteredImages.map((img, index) => (
                    <div 
                      key={index}
                      className={`relative group border-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:border-blue-500 ${
                        selectedUrl === img.url ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                      }`}
                      onClick={() => handleImageSelect(img.url)}
                    >
                      <div className="aspect-square">
                        <img 
                          src={normalizeImageUrl(img.url)} 
                          alt={img.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.src = '';
                            e.target.removeAttribute('src');
                          }}
                        />
                      </div>
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                        <div className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity text-center p-2">
                          <div className="truncate">{img.name}</div>
                          <div className="text-xs text-gray-300 truncate">{img.type}</div>
                        </div>
                      </div>
                      
                      {/* Selected indicator */}
                      {selectedUrl === img.url && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {filteredImages.length} images available
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() => handleImageSelect('')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImagePicker;