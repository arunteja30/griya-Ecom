import React, { useState, useEffect } from 'react';

let toasts = [];

export function showToast(message, type = 'info', duration = 3000) {
  const id = Date.now() + Math.random();
  const toast = { id, message, type, duration };
  
  toasts.push(toast);
  
  // Trigger a custom event to notify ToastContainer
  window.dispatchEvent(new CustomEvent('showToast', { detail: toast }));
  
  // Auto remove after duration
  setTimeout(() => {
    removeToast(id);
  }, duration);
  
  return id;
}

export function removeToast(id) {
  toasts = toasts.filter(toast => toast.id !== id);
  window.dispatchEvent(new CustomEvent('removeToast', { detail: id }));
}

export default function ToastContainer() {
  const [toastList, setToastList] = useState([]);

  useEffect(() => {
    const handleShowToast = (event) => {
      setToastList(prev => [...prev, event.detail]);
    };

    const handleRemoveToast = (event) => {
      setToastList(prev => prev.filter(toast => toast.id !== event.detail));
    };

    window.addEventListener('showToast', handleShowToast);
    window.addEventListener('removeToast', handleRemoveToast);

    return () => {
      window.removeEventListener('showToast', handleShowToast);
      window.removeEventListener('removeToast', handleRemoveToast);
    };
  }, []);

  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-fresh-100/90 to-fresh-50/90 border-fresh-400 text-fresh-800 backdrop-blur-md shadow-glow-green';
      case 'error':
        return 'bg-gradient-to-r from-danger-100/90 to-danger-50/90 border-danger-400 text-danger-800 backdrop-blur-md shadow-glow';
      case 'warning':
        return 'bg-gradient-to-r from-warning-100/90 to-warning-50/90 border-warning-400 text-warning-800 backdrop-blur-md shadow-glow';
      default:
        return 'bg-gradient-to-r from-primary-100/90 to-primary-50/90 border-primary-400 text-primary-800 backdrop-blur-md shadow-glow';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (toastList.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:max-w-sm z-50 space-y-3 safe-area-top">
      {toastList.map((toast) => (
        <div
          key={toast.id}
          className={`w-full border-l-4 p-4 rounded-2xl shadow-float animate-slide-up ${getToastStyles(toast.type)}`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {getIcon(toast.type)}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 flex-shrink-0 p-1 rounded-lg text-current opacity-60 hover:opacity-80 hover:bg-white/20 transition-all touch-manipulation"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}