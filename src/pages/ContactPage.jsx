import React from "react";
import { useFirebaseObject } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";

export default function ContactPage() {
  const { data: settings, loading } = useFirebaseObject("/siteSettings");
  if (loading) return <Loader />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <SectionTitle title="Contact" />
        <div className="text-sm text-gray-700">{settings?.address}</div>
        <div className="mt-4">
          <a href={`https://wa.me/${settings?.whatsapp?.replace(/\D/g, '')}`} className="inline-block bg-green-600 text-white px-4 py-2 rounded">Message on WhatsApp</a>
        </div>
        <div className="mt-6 text-sm text-gray-600">Instagram: <a href={settings?.instagram}>{settings?.instagram}</a></div>
      </div>

      <div>
        <SectionTitle title="Visit Us" />
        {settings?.mapIframeUrl ? (
          <div className="w-full h-80">
            <iframe src={settings.mapIframeUrl} className="w-full h-full border-0" title="map" />
          </div>
        ) : (
          <div className="text-sm text-gray-500">Map not configured.</div>
        )}
      </div>
    </div>
  );
}
