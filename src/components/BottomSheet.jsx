import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

export default function BottomSheet({ isOpen = false, onClose = () => {}, children, title, footer, maxWidth = 'max-w-3xl' }) {
  if (typeof document === 'undefined') return null;
  if (!isOpen) return null;

  useEffect(() => {
    // lock background scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const sheet = (
    <div className="fixed inset-0 z-[9999] flex items-end" onClick={onClose}>
      {/* dimmed overlay covering whole screen */}
      <div className="absolute inset-0 bg-black/40 transition-opacity" />

      {/* sheet container */}
      <div 
        className="relative w-full bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col pb-safe"
        onClick={(e) => e.stopPropagation()}
      > 
        {/* Header with drag handle */}
        <div className="relative flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          {/* Drag handle */}
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full"></div>
          <div className="text-lg font-semibold">{title || 'Select Option'}</div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-auto px-4 py-3">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-gray-200 flex-shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(sheet, document.body);
}
