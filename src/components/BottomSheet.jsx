import React from 'react';
import { Link } from 'react-router-dom';

export default function BottomSheet({ isOpen = false, onClose = () => {}, children, title, footer, maxWidth = 'max-w-3xl' }) {
  return (
    // full-screen container so overlay blocks entire UI when open
    <div className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isOpen}>
      {/* dimmed overlay covering whole screen */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* sheet container - 40% height from bottom */}
      <div className={`absolute inset-x-0 bottom-0 ${isOpen ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300`}> 
        <div className="bg-white rounded-t-2xl shadow-2xl" style={{ height: '40vh', minHeight: '300px' }}>
          <div className="flex items-center justify-between p-4 border-b border-surface-200">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-surface-300 rounded-full mx-auto absolute left-1/2 transform -translate-x-1/2 -top-3"></div>
            <div className="text-lg font-semibold">{title || 'Select Option'}</div>
            <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors">
              <svg className="w-6 h-6 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-auto" style={{ height: 'calc(40vh - 80px)' }}>{children}</div>
          {footer && (
            <div className="p-4 border-t border-surface-200">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
