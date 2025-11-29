import React from "react";
import { useBanners, useSiteContent, useProducts, useSiteSettings } from "../hooks/useRealtime";
import { Link } from "react-router-dom";

export default function Home() {
  const { data: banners, loading: bannersLoading } = useBanners();
  const { data: siteContent } = useSiteContent();
  const { data: products, loading: productsLoading } = useProducts();
  const { data: settings } = useSiteSettings();

  return (
    <div>
      {/* Featured Products - keep at top */}
      <section className="mb-8 bg-red-100 shadow-md rounded p-4">
        <h2 className="text-2xl font-semibold mb-4">Featured Products</h2>
        {productsLoading ? (
          <div>Loading products...</div>
        ) : products ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(products).map(([id, p]) => (
              <Link to={`/products/${id}`} key={id} className="block border rounded p-2">
                <img src={p.image || '/placeholder.jpg'} alt={p.title} className="w-full h-40 object-cover mb-2 rounded" />
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-sm text-gray-600">₹{p.price}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div>No products found</div>
        )}
      </section>

      {/* Banners moved here so they are visible only on the Home screen and appear below Featured Products */}
      <section className="mb-8">
        {bannersLoading ? (
          <div>Loading banners...</div>
        ) : banners ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(banners).map(([key, banner]) => (
              <div key={key} className="relative h-64 bg-gray-100 rounded overflow-hidden">
                <img src={banner.image || '/placeholder.jpg'} alt={banner.title || 'Banner'} className="w-full h-full object-cover" />
                <div className="absolute left-6 bottom-6 text-white">
                  <h2 className="text-2xl font-bold">{banner.title}</h2>
                  <p className="mt-2">{banner.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>No banners configured</div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold mb-4">About</h2>
        <div className="prose max-w-none">
          {siteContent?.about || 'About text not configured in database.'}
        </div>

        {/* Footer details reproduced in About screen */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <img src={settings?.logoUrl || '/placeholder.jpg'} alt="logo" className="h-10 w-10 rounded-lg object-cover shadow-sm" />
                <div>
                  <div className="font-bold text-sm">{settings?.brandName || 'Griya'}</div>
                  <div className="text-sm text-gray-500">{settings?.tagline || ''}</div>
                </div>
              </div>
              {settings?.footerText && <p className="text-sm text-gray-600 mb-2">{settings.footerText}</p>}
              {settings?.address && <div className="text-sm text-gray-600">{settings.address}</div>}
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Quick Links</h3>
              <nav className="flex flex-col gap-2 text-sm text-gray-600">
                <Link to="/">Home</Link>
                <Link to="/groceries">Groceries</Link>
                <Link to="/gallery">Gallery</Link>
                <Link to="/contact">Contact</Link>
              </nav>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Connect</h3>
              <div className="flex flex-col gap-2 text-sm text-gray-600">
                {settings?.whatsapp && (
                  <a href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-600">WhatsApp: {settings.whatsapp}</a>
                )}
                {settings?.instagram && (
                  <a href={settings.instagram} target="_blank" rel="noreferrer" className="text-pink-600">Instagram</a>
                )}
              </div>
            </div>
          </div>

          <div className="border-t mt-6 pt-4 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
            <div>© {new Date().getFullYear()} {settings?.brandName || 'Griya'}. All rights reserved.</div>
            <div className="flex gap-4 mt-3 md:mt-0">
              <Link to="/privacy" className="text-gray-600">Privacy</Link>
              <Link to="/terms" className="text-gray-600">Terms</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
