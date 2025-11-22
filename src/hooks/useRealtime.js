import { useEffect, useState, useRef } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase";

/**
 * Generic hook to subscribe to a Realtime Database path.
 * Returns { data, loading, error } and automatically detaches on unmount.
 *
 * Usage:
 * const { data, loading, error } = useRealtime('/products');
 */
export function useRealtime(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pathRef = useRef(path);

  useEffect(() => {
    pathRef.current = path;
    setLoading(true);
    const dbRef = ref(db, path);
    const listener = onValue(
      dbRef,
      (snapshot) => {
        setData(snapshot.exists() ? snapshot.val() : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      // detach listener
      off(dbRef);
    };
  }, [path]);

  return { data, loading, error };
}

/*
Convenience hooks for the paths you requested. Each returns { data, loading, error }.
Adjust paths to match your DB structure.
*/
export const useSiteContent = () => useRealtime("/siteContent");
export const useBanners = () => useRealtime("/banners");
export const useCategories = () => useRealtime("/categories");
export const useProducts = () => useRealtime("/products");
export const useSiteSettings = () => useRealtime("/siteSettings");
export const useNavigation = () => useRealtime("/navigation");
export const useHome = () => useRealtime("/home");
export const useGallery = () => useRealtime("/gallery");
export const useTestimonials = () => useRealtime("/testimonials");

/*
Hook to return all products as array and helper lookups
*/
export function useProductsList() {
  const { data, loading, error } = useRealtime("/products");
  const productsArray = data ? Object.entries(data).map(([id, p]) => ({ id, ...p })) : [];
  return { data: productsArray, loading, error };
}

/*
Hook to lookup a single product by slug or id
*/
export function useProductBySlug(slug) {
  const { data, loading, error } = useRealtime("/products");
  const product = data ? Object.values(data).find((p) => p.slug === slug || p.id === slug) : null;
  return { data: product, loading, error };
}
