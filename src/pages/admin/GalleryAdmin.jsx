import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../firebase';
import { ref, onValue, push, update, remove } from 'firebase/database';
import Loader from '../../components/Loader';
import Modal from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { normalizeImageUrl } from '../../utils/imageHelpers';
import AdminCard from './AdminCard';

export default function GalleryAdmin(){
  const [gallery, setGallery] = useState({});
  const [products, setProducts] = useState({});
  const [categories, setCategories] = useState({});
  const [merchantProducts, setMerchantProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState('gallery'); // gallery, existing
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(()=>{
    let loadingCount = 4;
    const checkAllLoaded = () => {
      loadingCount--;
      if (loadingCount === 0) {
        setLoading(false);
      }
    };

    // Load gallery
    const galleryRef = ref(db, '/gallery');
    const galleryUnsubscribe = onValue(galleryRef, snap=>{
      setGallery(snap.val() || {});
      checkAllLoaded();
    });

    // Load products
    const productsRef = ref(db, '/products');
    const productsUnsubscribe = onValue(productsRef, snap=>{
      setProducts(snap.val() || {});
      checkAllLoaded();
    });

    // Load categories
    const categoriesRef = ref(db, '/categories');
    const categoriesUnsubscribe = onValue(categoriesRef, snap=>{
      setCategories(snap.val() || {});
      checkAllLoaded();
    });

    // Load merchant products
    const merchantProductsRef = ref(db, '/merchantProducts');
    const merchantProductsUnsubscribe = onValue(merchantProductsRef, snap=>{
      setMerchantProducts(snap.val() || {});
      checkAllLoaded();
    });

    return () => {
      galleryUnsubscribe();
      productsUnsubscribe();
      categoriesUnsubscribe();
      merchantProductsUnsubscribe();
    };
  },[]);

  const handleSave = async ()=>{
    try{
      // Trim and validate URL
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        showToast('Please enter an image URL', 'error');
        return;
      }

      if(editing){
        // For editing, allow same URL for current item, but check against others
        const isDuplicate = Object.entries(gallery).some(([id, item]) => 
          id !== editing && item.url === trimmedUrl
        );
        
        if (isDuplicate) {
          showToast('This URL already exists in the gallery', 'error');
          return;
        }
        
        await update(ref(db, `/gallery/${editing}`), { url: trimmedUrl });
        showToast('Gallery item updated');
      } else {
        // For adding new item, check if URL already exists
        const isDuplicate = Object.values(gallery).some(item => item.url === trimmedUrl);
        
        if (isDuplicate) {
          showToast('This URL already exists in the gallery', 'error');
          return;
        }
        
        await push(ref(db, '/gallery'), { url: trimmedUrl });
        setUrl('');
        showToast('Gallery item added');
      }
      setEditing(null);
    }catch(e){
      console.error(e);
      showToast('Error saving gallery item');
    }
  };

  const confirmDelete = (id)=>{ setToDelete(id); setShowDelete(true); };
  
  const doDelete = async ()=>{
    try{
      await remove(ref(db, `/gallery/${toDelete}`));
      showToast('Gallery item deleted');
    }catch(e){
      console.error(e);
      showToast('Error deleting gallery item');
    }finally{
      setShowDelete(false); setToDelete(null);
    }
  };

  const existingImages = useMemo(() => {
    const existingImages = [];
    
    // Add category images
    Object.entries(categories).forEach(([id, category]) => {
      if (category.image) {
        existingImages.push({
          url: category.image,
          name: category.name,
          type: 'Category',
          source: `Category: ${category.name}`
        });
      }
    });
    
    // Add global product images (avoid duplicates for products with variants)
    Object.entries(products).forEach(([id, product]) => {
      const uniqueUrls = new Set();
      
      // Add main image URL if not already added
      if (product.imageUrl && !uniqueUrls.has(product.imageUrl)) {
        uniqueUrls.add(product.imageUrl);
        existingImages.push({
          url: product.imageUrl,
          name: product.name,
          type: 'Product',
          source: `Product: ${product.name}`
        });
      }
      
      // Add additional images, avoiding duplicates
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach((img, index) => {
          if (img && !uniqueUrls.has(img)) {
            uniqueUrls.add(img);
            existingImages.push({
              url: img,
              name: product.name,
              type: 'Product',
              source: `Product: ${product.name} (Image ${index + 1})`
            });
          }
        });
      }
    });
    
    // Add merchant product images (avoid duplicates for products with variants)
    Object.entries(merchantProducts).forEach(([merchantId, merchantProductList]) => {
      Object.entries(merchantProductList || {}).forEach(([productId, product]) => {
        const uniqueUrls = new Set();
        
        // Add main image URL if not already added
        if (product.imageUrl && !uniqueUrls.has(product.imageUrl)) {
          uniqueUrls.add(product.imageUrl);
          existingImages.push({
            url: product.imageUrl,
            name: product.name,
            type: 'Merchant Product',
            source: `Merchant Product: ${product.name}`
          });
        }
        
        // Add additional images, avoiding duplicates
        if (product.images && Array.isArray(product.images)) {
          product.images.forEach((img, index) => {
            if (img && !uniqueUrls.has(img)) {
              uniqueUrls.add(img);
              existingImages.push({
                url: img,
                name: product.name,
                type: 'Merchant Product',
                source: `Merchant Product: ${product.name} (Image ${index + 1})`
              });
            }
          });
        }
      });
    });
    
    // Remove duplicates based on URL
    const uniqueImages = existingImages.filter((image, index, self) => 
      index === self.findIndex(img => img.url === image.url)
    );
    
    return uniqueImages;
  }, [categories, products, merchantProducts]);

  // Filter gallery to remove duplicates
  const uniqueGallery = useMemo(() => {
    const seenUrls = new Set();
    const uniqueEntries = {};
    
    Object.entries(gallery).forEach(([id, item]) => {
      if (item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        uniqueEntries[id] = item;
      }
    });
    
    return uniqueEntries;
  }, [gallery]);

  // Filter existing images to exclude ones already in gallery and apply search
  const filteredExistingImages = useMemo(() => {
    const galleryUrls = new Set(Object.values(gallery).map(item => item.url).filter(Boolean));
    let filtered = existingImages.filter(img => !galleryUrls.has(img.url));
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img => 
        img.name.toLowerCase().includes(query) ||
        img.source.toLowerCase().includes(query) ||
        img.type.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [existingImages, gallery, searchQuery]);

  if(loading) return <Loader />;

  return (
    <AdminCard title="Gallery Management" subtitle="Manage and organize media assets">
      {/* Tab Navigation */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'gallery'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Gallery ({Object.keys(uniqueGallery).length})
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'existing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Existing Images ({filteredExistingImages.length})
          </button>
        </nav>
      </div>

      {activeTab === 'gallery' && (
        <>
          <div className="mb-4 flex gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Image URL</label>
              <input 
                value={url} 
                onChange={(e)=>setUrl(e.target.value)} 
                className="border p-2 rounded w-96" 
                placeholder="Image URL" 
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleSave} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                {editing ? 'Update' : 'Add'}
              </button>
              {editing && (
                <button 
                  onClick={() => {setEditing(null); setUrl('')}} 
                  className="ml-2 px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {Object.entries(uniqueGallery).map(([id, g])=> (
              <div key={id} className="border border-gray-200 rounded-lg p-2 bg-white shadow-sm">
                <div className="aspect-square mb-2 overflow-hidden rounded-lg bg-gray-100">
                  <img 
                    src={normalizeImageUrl(g.url)} 
                    alt="Gallery item" 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.src = '';
                      e.target.removeAttribute('src');
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mb-1 break-all text-center truncate" title={g.url}>
                  {g.url}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={()=>{setEditing(id); setUrl(g.url)}} 
                    className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={()=>confirmDelete(id)} 
                    className="flex-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {Object.keys(uniqueGallery).length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                No images in gallery. Add some images to get started.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'existing' && (
        <>
          <div className="mb-4 text-sm text-gray-600">
            These images are currently used in products and categories. You can add them to the gallery if needed.
          </div>
          
          {/* Search for existing images */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, source, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-500">
                {filteredExistingImages.length} result{filteredExistingImages.length !== 1 ? 's' : ''} found for "{searchQuery}"
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {filteredExistingImages.map((img, index) => {
              const isInGallery = Object.values(gallery).some(item => item.url === img.url);
              
              return (
              <div key={index} className="border border-gray-200 rounded-lg p-2 bg-white shadow-sm">
                <div className="aspect-square mb-1 overflow-hidden rounded-lg bg-gray-100">
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
                <div className="mb-1">
                  <div className="font-medium text-xs text-gray-900 truncate text-center" title={img.name}>
                    {img.name}
                  </div>
                  <div className="text-xs text-blue-600 bg-blue-50 px-1 py-0.5 rounded mt-1 text-center">
                    {img.type}
                  </div>
                </div>
                {isInGallery ? (
                  <div className="w-full px-1 py-1 text-xs bg-gray-100 text-gray-500 rounded text-center">
                    Already in Gallery
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      // Add to gallery
                      setUrl(img.url);
                      setActiveTab('gallery');
                    }}
                    className="w-full px-1 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Add
                  </button>
                )}
              </div>
              );
            })}
            
            {filteredExistingImages.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                {searchQuery ? (
                  <>
                    <p>No images found matching "{searchQuery}".</p>
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  'No images found in products or categories.'
                )}
              </div>
            )}
          </div>
        </>
      )}

      <Modal isOpen={showDelete} hideActions onClose={()=>setShowDelete(false)} title="Delete gallery item?">
        <p>Are you sure?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={()=>setShowDelete(false)} className="px-4 py-2">Cancel</button>
          <button onClick={doDelete} className="px-4 py-2 bg-red-600 text-white rounded">Delete</button>
        </div>
      </Modal>
    </AdminCard>
  );
}
