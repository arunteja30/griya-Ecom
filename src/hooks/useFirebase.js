import { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebase";

// Subscribe to a path that represents a list or object. Returns snapshot value (object) as data.
export function useFirebaseList(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    const dbRef = ref(db, path);
    const unsubscribe = onValue(
      dbRef,
      (snap) => {
        setData(snap.exists() ? snap.val() : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try { off(dbRef); } catch (e) { /* ignore */ }
    };
  }, [path]);

  return { data, loading, error };
}

// Alias for list when we expect a single object; kept for semantics
export function useFirebaseObject(path) {
  return useFirebaseList(path);
}

// Find a product by slug under /products
export function useProductBySlug(slug) {
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
    const dbRef = ref(db, "/products");
    const listener = onValue(
      dbRef,
      (snap) => {
        const products = snap.exists() ? snap.val() : null;
        if (!products) {
          setData(null);
          setLoading(false);
          return;
        }
        // find by slug but keep the key as id
        let found = null;
        for (const [key, p] of Object.entries(products)) {
          if (p.slug === slug || key === slug || p.id === slug) {
            found = { ...p, id: key };
            break;
          }
        }
        setData(found || null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try { off(dbRef); } catch (e) {}
    };
  }, [slug]);

  return { data, loading, error };
}

// Find a category by slug under /categories
export function useCategoryBySlug(slug) {
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
    const dbRef = ref(db, "/categories");
    const listener = onValue(
      dbRef,
      (snap) => {
        const categories = snap.exists() ? snap.val() : null;
        if (!categories) {
          setData(null);
          setLoading(false);
          return;
        }
        // search by slug, by key (id) or by embedded id field
        let found = null;
        for (const [key, c] of Object.entries(categories)) {
          if (!c) continue;
          if (c.slug === slug || key === slug || c.id === slug) {
            found = { ...c, id: key };
            break;
          }
        }
        setData(found || null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      try { off(dbRef); } catch (e) {}
    };
  }, [slug]);

  return { data, loading, error };
}
