import React from "react";
import { Link } from "react-router-dom";
import { useFirebaseObject, useFirebaseList } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import { normalizeImageUrl } from '../utils/imageHelpers';


export default function HomePage() {
  const { data: home, loading: homeLoading } = useFirebaseObject("/home");
  const { data: productsDataObj, loading: productsLoading } = useFirebaseList("/products");
  const products = productsDataObj ? productsDataObj : null;
  const { data: testimonials, loading: testimonialsLoading } = useFirebaseList("/testimonials");

  if (homeLoading || productsLoading) return <Loader />;

  const newArrivalsIds = home?.sections?.newArrivals?.productIds || [];
  const bestSellersIds = home?.sections?.bestSellers?.productIds || [];

  const findProducts = (ids) => ids.map((id) => products?.[id]).filter(Boolean);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={normalizeImageUrl(home?.hero?.image) || '/placeholder.jpg'} 
            alt={home?.hero?.title} 
            className="w-full h-full object-cover scale-110 animate-fade-in" 
          />
          <div className="hero-overlay absolute inset-0"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <h1 className="section-title text-white mb-6 animate-fade-in-up">
            {home?.hero?.title || 'Discover Timeless Elegance'}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
            {home?.hero?.subtitle || 'Exquisite jewellery crafted with passion and precision'}
          </p>
          {home?.hero?.buttonUrl && (
            <div className="space-x-4 animate-fade-in-up" style={{animationDelay: '0.4s'}}>
              <a 
                href={home.hero.buttonUrl} 
                className="btn btn-primary btn-lg shadow-2xl"
              >
                {home.hero.buttonText || 'Explore Collection'}
              </a>
              <a 
                href="/collections" 
                className="btn btn-secondary btn-lg bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30"
              >
                View Catalog
              </a>
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Section hidden */}}
      <section className="py-20 bg-neutral-50">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="section-title">
              {home?.sections?.newArrivals?.title || 'New Arrivals'}
            </h2>
            <p className="section-subtitle">
              Discover our latest collection of stunning pieces
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-stagger">
            {findProducts(newArrivalsIds).map((p, index) => (
              <div key={p.id} style={{animationDelay: `${index * 0.1}s`}}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/collections" className="btn btn-secondary">
              View All Products
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Best Sellers */}
      <section className="py-20 bg-white">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="section-title">
              {home?.sections?.bestSellers?.title || 'Best Sellers'}
            </h2>
            <p className="section-subtitle">
              Our most loved pieces, chosen by customers like you
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 animate-stagger">
            {findProducts(bestSellersIds).map((p, index) => (
              <div key={p.id} style={{animationDelay: `${index * 0.1}s`}}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="section-container">
          <div className="text-center mb-16">
            <h2 className="section-title">What Our Customers Say</h2>
            <p className="section-subtitle">
              Hear from those who have experienced our exceptional service
            </p>
          </div>
          {testimonialsLoading ? (
            <div className="flex justify-center">
              <Loader />
            </div>
          ) : testimonials ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-stagger">
              {Object.entries(testimonials).map(([id, t], index) => (
                <div 
                  key={id} 
                  className="card-glass p-8 text-center group hover:scale-105"
                  style={{animationDelay: `${index * 0.2}s`}}
                >
                  {/* Rating Stars */}
                  {typeof t.rating !== 'undefined' && (
                    <div className="flex justify-center mb-4">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(Math.max(0, Math.min(5, t.rating || 0))) 
                              ? 'text-yellow-400' 
                              : 'text-neutral-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  )}

                  {/* Testimonial Text */}
                  <blockquote className="text-neutral-700 mb-6 italic text-lg leading-relaxed">
                    "{t.message ?? t.review}"
                  </blockquote>

                  {/* Customer Info */}
                  <div className="flex items-center justify-center space-x-4">
                    {t.photo ? (
                      <img 
                        src={t.photo} 
                        alt={t.name} 
                        className="w-12 h-12 object-cover rounded-full border-2 border-white shadow-md" 
                      />
                    ) : (
                      <div className="w-12 h-12 bg-accent-200 rounded-full flex items-center justify-center">
                        <span className="text-accent-700 font-semibold text-sm">
                          {t.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-semibold text-primary-900">{t.name}</div>
                      {t.date && (
                        <div className="text-xs text-neutral-500">{t.date}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-neutral-500 py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>No testimonials available at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-10 bg-primary-900 text-white">
        <div className="section-container" hidden>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-serif">
              Stay in the Loop
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              Be the first to know about new collections, exclusive offers, and jewelry care tips.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Enter your email address"
                className="form-input flex-1 text-neutral-900"
                required
              />
              <button
                type="submit"
                className="btn btn-accent px-8"
              >
                Subscribe
              </button>
            </form>
            <p className="text-sm text-primary-300 mt-4">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
