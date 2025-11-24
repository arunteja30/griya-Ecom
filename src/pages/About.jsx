import React from 'react';
import { Link } from 'react-router-dom';
import { useSiteContent, useSiteSettings } from '../hooks/useRealtime';

export default function About() {
  const { data: siteContent } = useSiteContent();
  const { data: settings } = useSiteSettings();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">About</h1>
      <div className="prose max-w-none">
        {siteContent?.about || 'About text not configured in database.'}
      </div>

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
    </div>
  );
}
