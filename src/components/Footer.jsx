import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useRealtime";

export default function Footer() {
  const { data: settings } = useSiteSettings();

  const cleanPhone = (p) => {
    if (!p && p !== 0) return '';
    return String(p).replace(/\D/g, '');
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="hidden md:block bg-primary-900 text-white">
      <div className="section-container py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src={settings?.logoUrl || '/placeholder.jpg'} alt="logo" className="h-8 w-8 rounded-lg object-cover shadow-sm" />
              <div>
                <div className="font-bold text-sm font-serif">{settings?.brandName || 'Griya Jewellery'}</div>
                <div className="text-primary-300 text-xs">{settings?.tagline || 'Timeless Elegance'}</div>
              </div>
            </div>
            <p className="text-primary-200 text-sm hidden md:block mb-2">{settings?.footerText || 'Crafting exceptional jewellery pieces.'}</p>
            {settings?.address && <div className="text-primary-200 text-sm">{settings.address}</div>}
          </div>

          <div>
            <h3 className="font-bold text-sm mb-2">Quick Links</h3>
            <nav className="space-y-2 text-sm text-primary-200">
              <Link to="/">Home</Link>
              <Link to="/groceries">Groceries</Link>
              <Link to="/gallery">Gallery</Link>
              <Link to="/contact">Contact</Link>
            </nav>
          </div>

          <div>
            <h3 className="font-bold text-sm mb-2">Connect</h3>
            <div className="flex flex-col gap-2 text-sm">
              {settings?.whatsapp && (
                <a href={`https://wa.me/${cleanPhone(settings.whatsapp)}`} target="_blank" rel="noreferrer" className="text-primary-200">
                  WhatsApp
                </a>
              )}
              {settings?.instagram && (
                <a href={settings.instagram} target="_blank" rel="noreferrer" className="text-primary-200">
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-primary-800">
        <div className="section-container py-4">
          <div className="flex items-center justify-between text-sm text-primary-300">
            <div>© {currentYear} {settings?.brandName || 'Griya Jewellery'}. All rights reserved.</div>
            <div className="flex gap-4">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
