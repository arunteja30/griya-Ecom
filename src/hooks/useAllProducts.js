import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase";

// Hook to load products from both global products and all merchant products
export function useAllProducts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('useAllProducts: Starting to listen to all product sources');
    setLoading(true);
    setError(null);
    
    let globalProducts = {};
    let merchantProducts = {};
    let loadingCount = 2; // tracking both sources
    
    const updateCombinedProducts = () => {
      // Flatten all merchant products into one collection
      const allMerchantProducts = {};
      Object.entries(merchantProducts).forEach(([merchantId, products]) => {
        Object.entries(products || {}).forEach(([productId, product]) => {
          allMerchantProducts[productId] = {
            ...product,
            merchantId, // ensure merchantId is set
            _merchantSpecific: true // flag to identify merchant-specific products
          };
        });
      });
      
      // Combine global and merchant products
      const combinedProducts = {
        ...globalProducts,
        ...allMerchantProducts
      };
      
      console.log('useAllProducts: Combined products count:', Object.keys(combinedProducts).length);
      setData(combinedProducts);
    };
    
    const checkLoadingComplete = () => {
      loadingCount--;
      if (loadingCount === 0) {
        setLoading(false);
        updateCombinedProducts();
      }
    };
    
    // Listen to global products
    const globalRef = ref(db, '/products');
    const globalUnsubscribe = onValue(
      globalRef,
      (snap) => {
        console.log('useAllProducts: Got global products snapshot, exists:', snap.exists());
        globalProducts = snap.exists() ? snap.val() : {};
        updateCombinedProducts();
        checkLoadingComplete();
      },
      (err) => {
        console.error('useAllProducts: Error loading global products:', err);
        setError(err);
        checkLoadingComplete();
      }
    );
    
    // Listen to merchant products
    const merchantRef = ref(db, '/merchantProducts');
    const merchantUnsubscribe = onValue(
      merchantRef,
      (snap) => {
        console.log('useAllProducts: Got merchant products snapshot, exists:', snap.exists());
        merchantProducts = snap.exists() ? snap.val() : {};
        updateCombinedProducts();
        checkLoadingComplete();
      },
      (err) => {
        console.error('useAllProducts: Error loading merchant products:', err);
        setError(err);
        checkLoadingComplete();
      }
    );

    return () => {
      console.log('useAllProducts: Cleaning up listeners');
      try { 
        off(globalRef); 
        off(merchantRef);
      } catch (e) { 
        console.error('useAllProducts: Error cleaning up:', e); 
      }
    };
  }, []);

  return { data, loading, error };
}

// Find a product by slug across both global and merchant products
export function useProductBySlugAll(slug) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    let globalProducts = {};
    let merchantProducts = {};
    let loadingCount = 2;
    
    const findProductInData = () => {
      // Search in global products first
      for (const [key, p] of Object.entries(globalProducts)) {
        if (p.slug === slug || key === slug || p.id === slug) {
          return { ...p, id: key };
        }
      }
      
      // Search in merchant products
      for (const [merchantId, products] of Object.entries(merchantProducts)) {
        for (const [key, p] of Object.entries(products || {})) {
          if (p.slug === slug || key === slug || p.id === slug) {
            return { ...p, id: key, merchantId, _merchantSpecific: true };
          }
        }
      }
      
      return null;
    };
    
    const checkAndSetProduct = () => {
      const foundProduct = findProductInData();
      setData(foundProduct);
      loadingCount--;
      if (loadingCount === 0) {
        setLoading(false);
      }
    };
    
    // Listen to global products
    const globalRef = ref(db, '/products');
    const globalUnsubscribe = onValue(
      globalRef,
      (snap) => {
        globalProducts = snap.exists() ? snap.val() : {};
        checkAndSetProduct();
      },
      (err) => {
        console.error('useProductBySlugAll: Error loading global products:', err);
        setError(err);
        loadingCount--;
        if (loadingCount === 0) setLoading(false);
      }
    );
    
    // Listen to merchant products
    const merchantRef = ref(db, '/merchantProducts');
    const merchantUnsubscribe = onValue(
      merchantRef,
      (snap) => {
        merchantProducts = snap.exists() ? snap.val() : {};
        checkAndSetProduct();
      },
      (err) => {
        console.error('useProductBySlugAll: Error loading merchant products:', err);
        setError(err);
        loadingCount--;
        if (loadingCount === 0) setLoading(false);
      }
    );

    return () => {
      try { 
        off(globalRef); 
        off(merchantRef);
      } catch (e) { 
        console.error('useProductBySlugAll: Error cleaning up:', e); 
      }
    };
  }, [slug]);

  return { data, loading, error };
}