import React, { useEffect, useState } from 'react';

let emitter = null;

export function showToast(message, type = 'success', timeout = 4000){
  if(emitter) emitter.add(message, type, timeout);
}

export default function ToastContainer(){
  const [toasts, setToasts] = useState([]); // {id, message, type, visible}

  useEffect(()=>{
    emitter = {
      add: (message, type, timeout)=>{
        const id = Date.now() + Math.random();
        // add invisible first so we can trigger enter animation next tick
        setToasts(t=>[...t, {id, message, type, visible:false}]);
        // make visible on next tick
        requestAnimationFrame(()=>{
          setToasts(t=>t.map(x=> x.id===id ? {...x, visible:true} : x));
        });
        // schedule hide
        setTimeout(()=>{
          // trigger exit animation
          setToasts(t=>t.map(x=> x.id===id ? {...x, visible:false} : x));
          // remove after animation duration
          setTimeout(()=>{
            setToasts(t=>t.filter(x=>x.id!==id));
          }, 300);
        }, timeout);
      }
    };

    return ()=>{ emitter = null };
  },[]);

  const getToastStyles = (type) => {
    const baseStyles = 'glass-effect border shadow-lg';
    switch(type) {
      case 'success':
        return `${baseStyles} border-green-200 text-green-800 bg-green-50/90`;
      case 'error':
        return `${baseStyles} border-red-200 text-red-800 bg-red-50/90`;
      case 'warning':
        return `${baseStyles} border-yellow-200 text-yellow-800 bg-yellow-50/90`;
      case 'info':
        return `${baseStyles} border-blue-200 text-blue-800 bg-blue-50/90`;
      default:
        return `${baseStyles} border-neutral-200 text-neutral-800 bg-white/90`;
    }
  };

  const getToastIcon = (type) => {
    switch(type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 flex flex-col gap-3 items-center max-w-full px-4">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`transform transition-all duration-300 ease-out ${
            toast.visible 
              ? 'opacity-100 translate-y-0 scale-100' 
              : 'opacity-0 translate-y-6 scale-95'
          } ${getToastStyles(toast.type)} rounded-xl px-4 py-3 min-w-[280px]`}
        >
          <div className="flex items-center gap-3">
            {getToastIcon(toast.type)}
            <span className="font-medium text-sm flex-1">{toast.message}</span>
            <button 
              onClick={() => {
                setToasts(t => t.map(x => x.id === toast.id ? {...x, visible: false} : x));
                setTimeout(() => {
                  setToasts(t => t.filter(x => x.id !== toast.id));
                }, 300);
              }}
              className="text-neutral-400 hover:text-neutral-600 transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
