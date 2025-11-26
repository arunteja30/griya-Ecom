import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { CartContext } from "../context/CartContext";

export default function MobileBottomNav() {
  const location = useLocation();
  const { cartItems } = useContext(CartContext);
  const itemCount = cartItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0);

  const Icon = ({ children }) => (
    <div className="w-6 h-6 flex items-center justify-center">{children}</div>
  );

  const linkClass = (path) => `flex flex-col items-center justify-center text-xs gap-0.5 ${location.pathname === path ? 'text-primary-600' : 'text-neutral-600'}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t lg:hidden z-40">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between">
        <Link to="/" className={linkClass('/')}> 
          <Icon>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9.75L12 4l9 5.75V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.75z" />
            </svg>
          </Icon>
          <span className="text-[11px]">Home</span>
        </Link>

        <Link to="/collections" className={linkClass('/collections')}>
          <Icon>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </Icon>
          <span className="text-[11px]">Collections</span>
        </Link>

        <button onClick={() => { const el = document.querySelector('input.header-search'); if (el) { el.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} className="flex flex-col items-center text-neutral-600">
          <Icon>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </Icon>
          <span className="text-[11px]">Search</span>
        </button>

        <Link to="/cart" className={linkClass('/cart') + ' relative'}>
          <Icon>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 4h13" />
            </svg>
          </Icon>
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-primary-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{itemCount}</span>
          )}
          <span className="text-[11px]">Cart</span>
        </Link>

        
      </div>
    </nav>
  );
}
