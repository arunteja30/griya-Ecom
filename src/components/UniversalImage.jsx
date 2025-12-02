import React, { useEffect, useRef, useState } from 'react';

// A tiny universal image loader component with IntersectionObserver lazy-load,
// graceful fallback and simple blur-up placeholder. No external deps.
// Props: src, alt, className, style, placeholder, fallback, srcSet, sizes, onLoad, onError
export default function UniversalImage({ src, alt = '', className = '', style = {}, placeholder = '', fallback = '/placeholder.jpg', srcSet, sizes, onLoad, onError }) {
  const imgRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const [errored, setErrored] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // IntersectionObserver to lazy load
  useEffect(() => {
    if (!imgRef.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      });
    }, { rootMargin: '200px' });
    obs.observe(imgRef.current);
    return () => obs.disconnect();
  }, [imgRef]);

  // load image when visible
  useEffect(() => {
    if (!isVisible) return;
    if (!src) return;
    let active = true;
    const loader = new window.Image();
    if (srcSet) loader.srcset = srcSet;
    if (sizes) loader.sizes = sizes;
    loader.src = src;
    loader.onload = () => {
      if (!active) return;
      setLoadedSrc(src);
      setIsLoaded(true);
      setErrored(false);
      if (typeof onLoad === 'function') onLoad();
    };
    loader.onerror = (e) => {
      if (!active) return;
      setErrored(true);
      setLoadedSrc(fallback);
      setIsLoaded(true);
      if (typeof onError === 'function') onError(e);
    };
    return () => { active = false; };
  }, [isVisible, src, srcSet, sizes, fallback, onLoad, onError]);

  // choose what to show: loadedSrc if available, else placeholder
  const showSrc = isLoaded && loadedSrc ? loadedSrc : (placeholder || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');

  return (
    <div ref={imgRef} className={`universal-image-wrapper ${className || ''}`} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {/* low-res placeholder background */}
      {!isLoaded && placeholder && (
        <img src={placeholder} alt={alt} aria-hidden className="absolute inset-0 w-full h-full object-cover blur-md scale-105" style={{ filter: 'blur(12px)', transform: 'scale(1.03)' }} />
      )}

      <img
        src={showSrc}
        alt={alt}
        srcSet={srcSet}
        sizes={sizes}
        className="w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: isLoaded ? 1 : 0, display: 'block', width: '100%', height: '100%' }}
        onError={(e) => {
          if (!errored) {
            setErrored(true);
            setLoadedSrc(fallback);
            setIsLoaded(true);
          }
          if (typeof onError === 'function') onError(e);
        }}
      />
    </div>
  );
}
