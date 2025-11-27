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
    <footer className="bg-primary-900 text-white">
      <div className="section-container py-6 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src={settings?.logoUrl || '/placeholder.jpg'} alt="logo" className="h-8 w-8 rounded-md object-cover" />
          <div className="text-sm">
            <div className="font-bold leading-tight">{settings?.brandName || 'Griya Jewellery'}</div>
            <div className="text-primary-300 text-xs">{settings?.tagline || ''}</div>
          </div>
        </div>

        {/* Quick Links - inline */}
        <nav className="hidden sm:flex items-center gap-4 text-xs text-primary-300">
          <Link to="/" className="hover:text-white">Home</Link>
          <Link to="/collections" className="hover:text-white">Collections</Link>
          <Link to="/gallery" className="hover:text-white">Gallery</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <Link to="/admin" className="hover:text-white">Admin</Link>
          <a href="/track-order" className="hover:underline">Track Order</a>
        </nav>

        {/* Social / small details */}
        <div className="flex items-center gap-3 text-xs text-primary-300">
          {settings?.whatsapp && (
            <a href={`https://wa.me/${cleanPhone(settings.whatsapp)}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>
          )}
          {settings?.instagram && (
            <a href={settings.instagram} target="_blank" rel="noreferrer" className="hover:text-white">Instagram</a>
          )}
        </div>
      </div>

      <div className="border-t border-primary-800">
        <div className="section-container py-3 flex items-center justify-between text-xs text-primary-300">
          <div>© {currentYear} {settings?.brandName || 'Griya Jewellery'}. All rights reserved.</div>
          <div className="flex items-center gap-3">
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/admin" className="hover:text-white">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
