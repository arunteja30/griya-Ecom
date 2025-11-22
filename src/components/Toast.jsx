import React, { useEffect, useState } from 'react';

let emitter = null;

export function showToast(message, timeout = 3000){
  if(emitter) emitter.add(message, timeout);
}

export default function ToastContainer(){
  const [toasts, setToasts] = useState([]); // {id, message, visible}

  useEffect(()=>{
    emitter = {
      add: (message, timeout)=>{
        const id = Date.now()+Math.random();
        // add invisible first so we can trigger enter animation next tick
        setToasts(t=>[...t, {id, message, visible:false}]);
        // make visible on next tick
        requestAnimationFrame(()=>{
          setToasts(t=>t.map(x=> x.id===id ? {...x, visible:true} : x));
        });
        // schedule hide
        const total = timeout;
        setTimeout(()=>{
          // trigger exit animation
          setToasts(t=>t.map(x=> x.id===id ? {...x, visible:false} : x));
          // remove after animation duration
          setTimeout(()=>{
            setToasts(t=>t.filter(x=>x.id!==id));
          }, 220);
        }, total);
      }
    };

    return ()=>{ emitter = null };
  },[]);

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map(t=> (
        <div key={t.id} className={`transform transition-all duration-200 ease-out ${t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} bg-black text-white px-4 py-2 rounded shadow`}>{t.message}</div>
      ))}
    </div>
  );
}
