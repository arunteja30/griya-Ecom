import React, { useState, useEffect } from 'react';
import MobileLayout from '../components/MobileLayout';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';

export default function EditProfile() {
  const [person, setPerson] = useState(() => JSON.parse(localStorage.getItem('deliveryPerson') || '{}'));
  const [saving, setSaving] = useState(false);

  const handleChange = (key, value) => setPerson(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (person.firebaseKey) {
        const updates = {};
        updates[`/drivers/${person.firebaseKey}/name`] = person.name;
        updates[`/drivers/${person.firebaseKey}/phone`] = person.phone;
        await update(ref(db), updates);
      }
      localStorage.setItem('deliveryPerson', JSON.stringify(person));
      alert('Profile updated');
    } catch (e) {
      console.error(e);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileLayout activeTab="profile">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-semibold">Edit Profile</h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <input value={person.name || ''} onChange={(e) => handleChange('name', e.target.value)} className="input" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <input value={person.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} className="input" />
        </div>

        <div className="flex space-x-2">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </MobileLayout>
  );
}
