import React from "react";
import { useSiteSettings } from "../hooks/useRealtime";

export default function Footer() {
  const { data: settings } = useSiteSettings();

  const cleanPhone = (p) => {
    if (!p && p !== 0) return '';
    return String(p).replace(/\D/g, '');
  };

  return (
    <footer className="bg-gray-50 border-t mt-12">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <img src={settings?.logoUrl || '/placeholder.jpg'} alt="logo" className="h-10 w-10 rounded object-cover" />
            <div>
              <div className="font-semibold">{settings?.brandName}</div>
              <div className="text-sm text-gray-600">{settings?.tagline}</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">{settings?.address}</div>
        </div>

        <div className="flex flex-col gap-2">
          <a href={`https://wa.me/${cleanPhone(settings?.whatsapp)}`} target="_blank" rel="noreferrer" className="inline-block bg-green-600 text-white px-3 py-2 rounded">
            Message on WhatsApp
          </a>
          <a href={settings?.instagram} target="_blank" rel="noreferrer" className="text-sm text-gray-700">Instagram</a>
        </div>

        <div className="text-sm text-gray-500">{settings?.footerText}</div>
      </div>
    </footer>
  );
}
