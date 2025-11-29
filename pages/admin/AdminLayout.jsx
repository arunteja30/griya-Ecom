import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export default function AdminLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b z-40 md:hidden flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          <button aria-label="Open menu" onClick={()=>setDrawerOpen(true)} className="p-2 rounded hover:bg-neutral-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="font-bold">Admin Panel</div>
        </div>
        <div>
          <button className="text-sm text-red-600" onClick={()=>signOut(auth)}>Sign out</button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 transition-opacity ${drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} aria-hidden={!drawerOpen}>
        {/* overlay */}
        <div onClick={()=>setDrawerOpen(false)} className={`absolute inset-0 bg-black/40`}></div>
        {/* panel */}
        <aside className={`absolute left-0 top-0 bottom-0 w-64 bg-white border-r p-4 transform transition-transform ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-6 flex items-center justify-between">
            <div className="font-bold">Admin Panel</div>
            <button onClick={()=>setDrawerOpen(false)} className="p-1 rounded hover:bg-neutral-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <Link to="/admin" className="text-sm" onClick={()=>setDrawerOpen(false)}>Site Settings</Link>
            <Link to="/admin/theme" className="text-sm" onClick={()=>setDrawerOpen(false)}>Theme</Link>
            <Link to="/admin/categories" className="text-sm" onClick={()=>setDrawerOpen(false)}>Categories</Link>
            <Link to="/admin/products" className="text-sm" onClick={()=>setDrawerOpen(false)}>Products</Link>
            <div className="flex flex-col">
              <Link to="/admin/home" className="text-sm" onClick={()=>setDrawerOpen(false)}>Homepage Sections</Link>
              <Link to="/admin/home-config" className="text-sm ml-3 text-gray-600" onClick={()=>setDrawerOpen(false)}>Homepage Config</Link>
            </div>
            <Link to="/admin/banners" className="text-sm" onClick={()=>setDrawerOpen(false)}>Banners</Link>
            <Link to="/admin/gallery" className="text-sm" onClick={()=>setDrawerOpen(false)}>Gallery</Link>
            <Link to="/admin/testimonials" className="text-sm" onClick={()=>setDrawerOpen(false)}>Testimonials</Link>
            <Link to="/admin/orders" className="text-sm" onClick={()=>setDrawerOpen(false)}>Orders</Link>
            <Link to="/admin/seed" className="text-sm" onClick={()=>setDrawerOpen(false)}>Seed Sync</Link>
          </nav>
          <div className="mt-6">
            <button className="text-sm text-red-600" onClick={()=>{ setDrawerOpen(false); signOut(auth); }}>Sign out</button>
          </div>
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 bg-white border-r p-4">
        <div className="mb-6 font-bold">Admin Panel</div>
        <nav className="flex flex-col gap-2">
          <Link to="/admin" className="text-sm">Site Settings</Link>
          <Link to="/admin/theme" className="text-sm">Theme</Link>
          <Link to="/admin/categories" className="text-sm">Categories</Link>
          <Link to="/admin/products" className="text-sm">Products</Link>
          <div className="flex flex-col">
            <Link to="/admin/home" className="text-sm">Homepage Sections</Link>
            <Link to="/admin/home-config" className="text-sm ml-3 text-gray-600">Homepage Config</Link>
          </div>
          <Link to="/admin/banners" className="text-sm">Banners</Link>
          <Link to="/admin/gallery" className="text-sm">Gallery</Link>
          <Link to="/admin/testimonials" className="text-sm">Testimonials</Link>
          <Link to="/admin/orders" className="text-sm">Orders</Link>
          <Link to="/admin/seed" className="text-sm">Seed Sync</Link>
        </nav>
        <div className="mt-6">
          <button className="text-sm text-red-600" onClick={()=>signOut(auth)}>Sign out</button>
        </div>
      </aside>

      <main className="flex-1 p-6 bg-gray-50 pt-16 md:pt-6">{children}</main>
    </div>
  );
}
