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

  const brand = settings?.brandName || 'Our Brand';
  const phone = settings?.phone || settings?.contactPhone || '';
  const email = settings?.email || settings?.contactEmail || '';
  const address = settings?.address || '';

  return (
    <footer
      className="mt-12"
      style={{ background: 'var(--site-footer-bg, #0f172a)', color: 'var(--site-footer-text, #f8fafc)' }}
    >
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-neutral-900 font-bold">{(brand || 'B').charAt(0)}</div>
              <div>
                <div className="font-semibold text-lg">{brand}</div>
                <div className="text-sm text-neutral-300">Fine jewellery · Handcrafted</div>
              </div>
            </div>

            <p className="text-sm text-neutral-300">{settings?.footerAbout || 'Elegant, contemporary jewellery crafted with care.'}</p>

            <div className="mt-4 flex items-center gap-3">
              {settings?.instagram && (
                <a href={String(settings.instagram).startsWith('http') ? settings.instagram : `https://instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-yellow-400" aria-label="Instagram">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5zM18.5 6a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"/></svg>
                </a>
              )}

              {settings?.facebook && (
                <a href={settings.facebook} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-yellow-400" aria-label="Facebook">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2.2v-2.9h2.2V9.4c0-2.2 1.3-3.4 3.3-3.4.95 0 1.95.17 1.95.17v2.1h-1.08c-1.06 0-1.39.66-1.39 1.34v1.6h2.36l-.38 2.9h-1.98v7A10 10 0 0 0 22 12z"/></svg>
                </a>
              )}

              {settings?.whatsapp && (
                <a href={`https://wa.me/${cleanPhone(settings.whatsapp)}`} target="_blank" rel="noreferrer" className="text-neutral-300 hover:text-yellow-400" aria-label="WhatsApp">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3.6 20.4l-1.1 4 4-1.1A11 11 0 1 0 20.5 3.5zM12 19.2a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4z"/></svg>
                </a>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Quick links</h4>
            <ul className="text-sm text-white-300 space-y-2">
              <li><Link to="/collections" className="hover:text-yellow-400">Collections</Link></li>
              <li><Link to="/collections/new-arrivals" className="hover:text-yellow-400">New arrivals</Link></li>
              <li><Link to="/collections/best-sellers" className="hover:text-yellow-400">Best sellers</Link></li>
              <li><Link to="/contact" className="hover:text-yellow-400">Contact</Link></li>
              <li><Link to="/about" className="hover:text-yellow-400">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Contact</h4>
            <div className="text-sm text-neutral-300 space-y-2">
              {phone ? <div><a href={`tel:${cleanPhone(phone)}`} className="hover:text-yellow-400">{phone}</a></div> : null}
              {email ? <div><a href={`mailto:${email}`} className="hover:text-yellow-400">{email}</a></div> : null}
              {address ? <div className="text-xs text-neutral-400">{address}</div> : null}

              {/* Social links from site settings */}
              <div className="mt-2 flex items-center gap-3">
                {settings?.instagram && (
                  <a
                    href={String(settings.instagram).startsWith('http') ? settings.instagram : `https://instagram.com/${settings.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-300 hover:text-yellow-400 flex items-center gap-2"
                    aria-label="Instagram"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 6.5A4.5 4.5 0 1 0 16.5 13 4.5 4.5 0 0 0 12 8.5zM18.5 6a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"/></svg>
                    <span className="text-sm">{String(settings.instagram).replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>
                  </a>
                )}

                {settings?.whatsapp && (
                  <a
                    href={`https://wa.me/${cleanPhone(settings.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-300 hover:text-yellow-400 flex items-center gap-2"
                    aria-label="WhatsApp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3.6 20.4l-1.1 4 4-1.1A11 11 0 1 0 20.5 3.5zM12 19.2a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4z"/></svg>
                    <span className="text-sm">{settings.whatsapp}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

         
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-6 text-sm text-neutral-400 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>© {currentYear} {brand}. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-yellow-400">Privacy</Link>
            <Link to="/terms" className="hover:text-yellow-400">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
