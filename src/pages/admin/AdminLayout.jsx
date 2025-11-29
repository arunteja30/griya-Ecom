import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLayout({ children }) {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-2">
      <Link to="/admin" className="text-sm">Site Settings</Link>
      <Link to="/admin/theme" className="text-sm">Theme</Link>
      <Link to="/admin/categories" className="text-sm">Categories</Link>
      <Link to="/admin/products" className="text-sm">Products</Link>
      <Link to="/admin/banners" className="text-sm">Banners</Link>
      <Link to="/admin/home" className="text-sm">Homepage Sections</Link>
      <Link to="/admin/gallery" className="text-sm">Gallery</Link>
      <Link to="/admin/testimonials" className="text-sm">Testimonials</Link>
      <Link to="/admin/orders" className="text-sm">Orders</Link>
      <Link to="/admin/promo" className="text-sm">Promo Codes</Link>
      <Link to="/admin/seed" className="text-sm">Seed / JSON Editor</Link>
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-2 rounded-md hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold">Admin Panel</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => signOut(auth)} className="text-sm text-red-600">Sign out</button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="w-64 bg-white border-r p-4 hidden md:block">
        <div className="mb-6 font-bold">Admin Panel</div>
        {nav}
        <div className="mt-6">
          <button className="text-sm text-red-600" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-72 h-full bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">Admin Panel</div>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2 rounded-md hover:bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {nav}

            <div className="mt-6">
              <button className="text-sm text-red-600" onClick={() => { signOut(auth); setOpen(false); }}>Sign out</button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content - add top padding on small screens to avoid overlapping mobile header */}
      <main className="flex-1 p-6 bg-gray-50" style={{ paddingTop: '4rem' }}>
        {children}
      </main>
    </div>
  );
}
