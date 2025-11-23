import React from 'react';
import { useFirebaseObject } from '../hooks/useFirebase';

export default function AboutPage() {
  const { data: about } = useFirebaseObject('/about');
  const hero = about?.hero || { title: 'About QuickMart', subtitle: '', image: '/images/grocery-about.jpg' };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="grid md:grid-cols-2 gap-6 items-center">
        <div>
          <h1 className="text-2xl font-semibold mb-2">{hero.title}</h1>
          {hero.subtitle && <p className="text-neutral-600 mb-4">{hero.subtitle}</p>}

          {about?.content && (
            <div className="space-y-3">
              {about.content.map((p, i) => (
                <p key={i} className="text-neutral-700">{p}</p>
              ))}
            </div>
          )}

          {about?.contact && (
            <div className="mt-4 text-sm text-neutral-600">
              <div>Phone: {about.contact.phone}</div>
              <div>Email: {about.contact.email}</div>
              <div>Address: {about.contact.address}</div>
            </div>
          )}
        </div>

        <div>
          <img src={hero.image} alt={hero.title} className="w-full rounded-lg object-cover shadow-sm" />
        </div>
      </div>
    </div>
  );
}
