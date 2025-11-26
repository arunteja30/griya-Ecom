import React, { useState } from "react";
import { useFirebaseObject } from "../hooks/useFirebase";
import SectionTitle from "../components/SectionTitle";
import Loader from "../components/Loader";
import { showToast } from "../components/Toast";

export default function ContactPage() {
  const { data: settings, loading } = useFirebaseObject("/siteSettings");
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  if (loading) return <Loader />;

  const handleChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return showToast("Please provide name and message", "error");

    setSending(true);
    try {
      // Try to POST to an API endpoint; if none exists this will fail silently and we still show feedback
      await fetch((import.meta.env.VITE_API_BASE || "") + "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form })
      });
      showToast("Message sent — we will contact you shortly", "success");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      console.error(err);
      showToast("Failed to send message. Please try again or contact us directly.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="section-container py-8">
      <SectionTitle title="Contact Us" subtitle={settings?.contactSubtitle || "We'd love to hear from you"} showDecorator={false} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact form */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <h3 className="text-xl font-semibold mb-3">Send us a message</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={form.name} onChange={handleChange} placeholder="Your name" className="form-input" required />
                <input name="email" value={form.email} onChange={handleChange} placeholder="Email (optional)" className="form-input" />
              </div>

              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Phone (optional)" className="form-input" />

              <textarea name="message" value={form.message} onChange={handleChange} placeholder="How can we help you?" rows={6} className="form-input" required />

              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Sending...' : 'Send Message'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setForm({ name: '', email: '', phone: '', message: '' })}>Reset</button>
              </div>
            </form>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 border rounded">
                <div className="text-sm text-neutral-500">Address</div>
                <div className="font-medium text-sm mt-1">{settings?.address || 'Not configured'}</div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-neutral-500">Phone</div>
                <div className="font-medium text-sm mt-1">
                  {settings?.phone || settings?.mobile || '—'}
                </div>
                {settings?.whatsapp && (
                  <a className="text-sm text-green-600 mt-1 inline-block" href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g,'')}`}>WhatsApp us</a>
                )}
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-neutral-500">Email</div>
                <div className="font-medium text-sm mt-1">{settings?.contactEmail || settings?.email || '—'}</div>
              </div>
            </div>
          </div>

          {/* Opening hours & socials */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h4 className="font-semibold mb-2">Opening Hours</h4>
              {settings?.hours ? (
                <ul className="text-sm text-neutral-700">
                  {Object.entries(settings.hours).map(([day, val]) => (
                    <li key={day} className="flex justify-between">
                      <span className="capitalize">{day}</span>
                      <span>{val}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-neutral-500">Not available</div>
              )}
            </div>

            <div className="card p-4">
              <h4 className="font-semibold mb-2">Follow us</h4>
              <div className="flex items-center gap-3">
                {settings?.instagram && <a href={settings.instagram} className="text-sm text-neutral-700 hover:text-primary-600">Instagram</a>}
                {settings?.facebook && <a href={settings.facebook} className="text-sm text-neutral-700 hover:text-primary-600">Facebook</a>}
                {settings?.twitter && <a href={settings.twitter} className="text-sm text-neutral-700 hover:text-primary-600">Twitter</a>}
              </div>

            
            </div>
          </div>
        </div>

        {/* Map / visit card */}
        <aside>
          <div className="card overflow-hidden p-4 sticky top-24">
            <h4 className="font-semibold mb-3">Visit us</h4>
            {settings?.mapIframeUrl ? (
              <div className="w-full h-64 md:h-80">
                <iframe src={settings.mapIframeUrl} className="w-full h-full border-0" title="map" />
              </div>
            ) : (
              <div className="text-sm text-neutral-500">Map not configured.</div>
            )}

            <div className="mt-4">
              <a href={`tel:${settings?.phone || settings?.mobile}`} className="btn btn-primary w-full">Call us</a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
