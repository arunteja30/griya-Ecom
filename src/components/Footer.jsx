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
    <footer style={{ background: 'var(--site-footer-bg, var(--primary-900))', color: 'var(--site-footer-text, white)' }}>
      <div className="section-container py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-semibold">About</h3>
            <p className="text-sm mt-2">{/* ... */}</p>
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--site-footer-text, white)' }}>Contact</h3>
            <div className="text-sm mt-2" style={{ color: 'var(--site-footer-text, rgba(255,255,255,0.85))' }}>{settings?.address}</div>
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--site-footer-text, white)' }}>Follow</h3>
            <div className="text-sm mt-2" style={{ color: 'var(--site-footer-text, rgba(255,255,255,0.85))' }}>{settings?.instagram}</div>
          </div>
        </div>

        <div className="mt-8 text-sm text-white">© {new Date().getFullYear()} {settings?.brandName}. All rights reserved.</div>
      </div>
    </footer>
  );
}
