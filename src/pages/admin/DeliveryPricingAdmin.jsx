import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set, push } from 'firebase/database';
import { showToast } from '../../components/Toast';
import AdminCard from './AdminCard';

export default function DeliveryPricingAdmin() {
  const [pricingConfig, setPricingConfig] = useState({
    baseFee: 20,
    freeDeliveryThreshold: 300,
    driverEarningsPercentage: 80,
    // Admin delivery fee controls
    deliveryFeeEnabled: true,
    globalFreeDelivery: false,
    adminOverrideFee: 0,
    useAdminOverride: false,
    freeDeliverySchedule: {
      enabled: false,
      startDate: '',
      endDate: '',
      reason: 'Special Promotion'
    },
    conditionalFreeDelivery: {
      enabled: false,
      conditions: [
        { type: 'orderValue', value: 500, label: 'Orders above ₹500' },
        { type: 'timeRange', startTime: '18:00', endTime: '21:00', label: 'Evening hours' },
        { type: 'dayOfWeek', days: ['sunday'], label: 'Sundays' }
      ]
    },
    perKmRates: [
      { maxKm: 3, rate: 0, label: '0-3 km (Free)' },
      { maxKm: 5, rate: 5, label: '3-5 km' },
      { maxKm: 10, rate: 8, label: '5-10 km' },
      { maxKm: 999, rate: 12, label: '10+ km' }
    ],
    surgeHours: [
      { start: '12:00', end: '14:00', multiplier: 1.5, label: 'Lunch Rush' },
      { start: '19:00', end: '22:00', multiplier: 2.0, label: 'Dinner Rush' }
    ],
    weatherSurge: {
      enabled: true,
      rainMultiplier: 1.3,
      stormMultiplier: 1.8
    }
  });

  const [deliveryZones, setDeliveryZones] = useState([]);
  const [newZone, setNewZone] = useState({
    name: '',
    baseFee: 20,
    freeDeliveryThreshold: 300,
    maxDistance: 15
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load pricing configuration
    const pricingRef = ref(db, '/deliveryPricing/default');
    const pricingUnsubscribe = onValue(pricingRef, (snapshot) => {
      if (snapshot.exists()) {
        setPricingConfig(prev => ({ ...prev, ...snapshot.val() }));
      }
      setLoading(false);
    });

    // Load delivery zones
    const zonesRef = ref(db, '/deliveryZones');
    const zonesUnsubscribe = onValue(zonesRef, (snapshot) => {
      const data = snapshot.val() || {};
      setDeliveryZones(Object.entries(data).map(([id, zone]) => ({ id, ...zone })));
    });

    return () => {
      pricingUnsubscribe();
      zonesUnsubscribe();
    };
  }, []);

  const handleSavePricing = async () => {
    setSaving(true);
    try {
      await set(ref(db, '/deliveryPricing/default'), pricingConfig);
      showToast('Pricing configuration saved successfully!');
    } catch (error) {
      console.error('Error saving pricing:', error);
      showToast('Error saving pricing configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleAddZone = async () => {
    if (!newZone.name) {
      showToast('Zone name is required');
      return;
    }
    
    setSaving(true);
    try {
      await push(ref(db, '/deliveryZones'), {
        ...newZone,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setNewZone({ name: '', baseFee: 20, freeDeliveryThreshold: 300, maxDistance: 15 });
      showToast('Delivery zone added successfully!');
    } catch (error) {
      console.error('Error adding zone:', error);
      showToast('Error adding delivery zone');
    } finally {
      setSaving(false);
    }
  };

  const updatePerKmRate = (index, rate) => {
    const newRates = [...pricingConfig.perKmRates];
    newRates[index].rate = parseFloat(rate) || 0;
    setPricingConfig(prev => ({ ...prev, perKmRates: newRates }));
  };

  const updateSurgeHour = (index, field, value) => {
    const newSurgeHours = [...pricingConfig.surgeHours];
    newSurgeHours[index][field] = field === 'multiplier' ? parseFloat(value) || 1 : value;
    setPricingConfig(prev => ({ ...prev, surgeHours: newSurgeHours }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading pricing settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Pricing</h1>
          <p className="text-gray-600 mt-1">Configure delivery fees and driver earnings</p>
        </div>
        <button
          onClick={handleSavePricing}
          disabled={saving}
          className={`px-6 py-3 rounded-lg font-medium ${
            saving 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-primary-600 hover:bg-primary-700'
          } text-white`}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Real-time Sync Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="text-blue-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-blue-900">Real-time Sync Active</h4>
            <p className="text-sm text-blue-700">
              Changes made here will immediately reflect in customer and driver apps without requiring page refresh.
            </p>
          </div>
        </div>
      </div>

      {/* Current Status Overview */}
      <AdminCard title="Current Delivery Fee Status" subtitle="Overview of active settings">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border-2 ${
            !pricingConfig.deliveryFeeEnabled ? 'bg-red-50 border-red-200' : 
            pricingConfig.globalFreeDelivery ? 'bg-green-50 border-green-200' :
            pricingConfig.useAdminOverride ? 'bg-purple-50 border-purple-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="text-center">
              <div className="text-2xl mb-2">
                {!pricingConfig.deliveryFeeEnabled ? '🚫' : 
                 pricingConfig.globalFreeDelivery ? '🎉' :
                 pricingConfig.useAdminOverride ? '⚙️' : '📊'}
              </div>
              <div className="font-semibold text-sm">
                {!pricingConfig.deliveryFeeEnabled ? 'DISABLED' : 
                 pricingConfig.globalFreeDelivery ? 'FREE FOR ALL' :
                 pricingConfig.useAdminOverride ? 'FIXED FEE' : 'DYNAMIC PRICING'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {!pricingConfig.deliveryFeeEnabled ? 'All deliveries free' : 
                 pricingConfig.globalFreeDelivery ? 'Admin promotion active' :
                 pricingConfig.useAdminOverride ? `₹${pricingConfig.adminOverrideFee} fixed` : 'Distance-based calculation'}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border-2 ${
            pricingConfig.freeDeliverySchedule.enabled ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="text-center">
              <div className="text-2xl mb-2">{pricingConfig.freeDeliverySchedule.enabled ? '⏰' : '📅'}</div>
              <div className="font-semibold text-sm">
                {pricingConfig.freeDeliverySchedule.enabled ? 'SCHEDULED PROMO' : 'NO SCHEDULE'}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {pricingConfig.freeDeliverySchedule.enabled ? 
                  pricingConfig.freeDeliverySchedule.reason : 
                  'No time-based promotions'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border-2 bg-indigo-50 border-indigo-200">
            <div className="text-center">
              <div className="text-2xl mb-2">🚗</div>
              <div className="font-semibold text-sm">DRIVER EARNINGS</div>
              <div className="text-xs text-gray-600 mt-1">
                {pricingConfig.driverEarningsPercentage}% of delivery fee
              </div>
            </div>
          </div>
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Fee Control Panel */}
        <AdminCard title="Delivery Fee Control" subtitle="Enable/disable and override delivery fees">
          <div className="space-y-4">
            {/* Global Delivery Fee Toggle */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={pricingConfig.deliveryFeeEnabled}
                  onChange={(e) => setPricingConfig(prev => ({
                    ...prev,
                    deliveryFeeEnabled: e.target.checked
                  }))}
                  className="h-5 w-5 text-blue-600"
                />
                <label className="text-lg font-semibold text-gray-900">
                  Enable Delivery Fees
                </label>
              </div>
              <p className="text-sm text-gray-600">
                When disabled, all deliveries will be free for customers
              </p>
            </div>

            {/* Global Free Delivery Override */}
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={pricingConfig.globalFreeDelivery}
                  onChange={(e) => setPricingConfig(prev => ({
                    ...prev,
                    globalFreeDelivery: e.target.checked
                  }))}
                  className="h-5 w-5 text-green-600"
                />
                <label className="text-lg font-semibold text-gray-900">
                  Make All Deliveries Free
                </label>
              </div>
              <p className="text-sm text-gray-600">
                Override all delivery fee calculations - customers pay nothing
              </p>
            </div>

            {/* Admin Override Fee */}
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={pricingConfig.useAdminOverride}
                  onChange={(e) => setPricingConfig(prev => ({
                    ...prev,
                    useAdminOverride: e.target.checked
                  }))}
                  className="h-5 w-5 text-purple-600"
                />
                <label className="text-lg font-semibold text-gray-900">
                  Set Fixed Delivery Fee
                </label>
              </div>
              {pricingConfig.useAdminOverride && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fixed Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={pricingConfig.adminOverrideFee}
                    onChange={(e) => setPricingConfig(prev => ({
                      ...prev,
                      adminOverrideFee: parseFloat(e.target.value) || 0
                    }))}
                    className="w-full p-3 border border-purple-300 rounded-lg"
                    placeholder="25"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will override distance-based calculations
                  </p>
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        {/* Scheduled Free Delivery */}
        <AdminCard title="Scheduled Promotions" subtitle="Set time-based free delivery campaigns">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pricingConfig.freeDeliverySchedule.enabled}
                onChange={(e) => setPricingConfig(prev => ({
                  ...prev,
                  freeDeliverySchedule: {
                    ...prev.freeDeliverySchedule,
                    enabled: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-primary-600"
              />
              <label className="text-sm font-medium text-gray-700">
                Enable Scheduled Free Delivery
              </label>
            </div>

            {pricingConfig.freeDeliverySchedule.enabled && (
              <div className="space-y-4 bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Reason
                  </label>
                  <input
                    type="text"
                    value={pricingConfig.freeDeliverySchedule.reason}
                    onChange={(e) => setPricingConfig(prev => ({
                      ...prev,
                      freeDeliverySchedule: {
                        ...prev.freeDeliverySchedule,
                        reason: e.target.value
                      }
                    }))}
                    className="w-full p-3 border border-amber-300 rounded-lg"
                    placeholder="Holiday Special Offer"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="datetime-local"
                      value={pricingConfig.freeDeliverySchedule.startDate}
                      onChange={(e) => setPricingConfig(prev => ({
                        ...prev,
                        freeDeliverySchedule: {
                          ...prev.freeDeliverySchedule,
                          startDate: e.target.value
                        }
                      }))}
                      className="w-full p-3 border border-amber-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="datetime-local"
                      value={pricingConfig.freeDeliverySchedule.endDate}
                      onChange={(e) => setPricingConfig(prev => ({
                        ...prev,
                        freeDeliverySchedule: {
                          ...prev.freeDeliverySchedule,
                          endDate: e.target.value
                        }
                      }))}
                      className="w-full p-3 border border-amber-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </AdminCard>

        {/* Basic Pricing Configuration */}
        <AdminCard title="Basic Pricing" subtitle="Configure base delivery fees">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Delivery Fee (₹)
              </label>
              <input
                type="number"
                value={pricingConfig.baseFee}
                onChange={(e) => setPricingConfig(prev => ({ 
                  ...prev, 
                  baseFee: parseFloat(e.target.value) || 0 
                }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Free Delivery Threshold (₹)
              </label>
              <input
                type="number"
                value={pricingConfig.freeDeliveryThreshold}
                onChange={(e) => setPricingConfig(prev => ({ 
                  ...prev, 
                  freeDeliveryThreshold: parseFloat(e.target.value) || 0 
                }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver Earnings Percentage (%)
              </label>
              <input
                type="number"
                value={pricingConfig.driverEarningsPercentage}
                onChange={(e) => setPricingConfig(prev => ({ 
                  ...prev, 
                  driverEarningsPercentage: parseFloat(e.target.value) || 0 
                }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
                placeholder="80"
                min="0"
                max="100"
              />
              <p className="text-sm text-gray-500 mt-1">
                Platform fee: {100 - pricingConfig.driverEarningsPercentage}%
              </p>
            </div>
          </div>
        </AdminCard>

        {/* Distance-based Pricing */}
        <AdminCard title="Distance-based Pricing" subtitle="Configure per-km charges">
          <div className="space-y-4">
            {pricingConfig.perKmRates.map((rate, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {rate.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">₹</span>
                    <input
                      type="number"
                      value={rate.rate}
                      onChange={(e) => updatePerKmRate(index, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded"
                      placeholder="0"
                      min="0"
                    />
                    <span className="text-sm text-gray-500">/km</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* Surge Pricing */}
        <AdminCard title="Surge Pricing" subtitle="Configure peak hour multipliers">
          <div className="space-y-4">
            {pricingConfig.surgeHours.map((surge, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {surge.label}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={surge.start}
                      onChange={(e) => updateSurgeHour(index, 'start', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Time</label>
                    <input
                      type="time"
                      value={surge.end}
                      onChange={(e) => updateSurgeHour(index, 'end', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Multiplier</label>
                    <input
                      type="number"
                      step="0.1"
                      value={surge.multiplier}
                      onChange={(e) => updateSurgeHour(index, 'multiplier', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      min="1"
                      max="3"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </AdminCard>

        {/* Weather Surge */}
        <AdminCard title="Weather Surge" subtitle="Configure weather-based pricing">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={pricingConfig.weatherSurge.enabled}
                onChange={(e) => setPricingConfig(prev => ({
                  ...prev,
                  weatherSurge: { ...prev.weatherSurge, enabled: e.target.checked }
                }))}
                className="h-4 w-4 text-primary-600"
              />
              <label className="text-sm font-medium text-gray-700">
                Enable Weather-based Surge Pricing
              </label>
            </div>

            {pricingConfig.weatherSurge.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rain Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricingConfig.weatherSurge.rainMultiplier}
                    onChange={(e) => setPricingConfig(prev => ({
                      ...prev,
                      weatherSurge: {
                        ...prev.weatherSurge,
                        rainMultiplier: parseFloat(e.target.value) || 1
                      }
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    min="1"
                    max="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Storm Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricingConfig.weatherSurge.stormMultiplier}
                    onChange={(e) => setPricingConfig(prev => ({
                      ...prev,
                      weatherSurge: {
                        ...prev.weatherSurge,
                        stormMultiplier: parseFloat(e.target.value) || 1
                      }
                    }))}
                    className="w-full p-3 border border-gray-300 rounded-lg"
                    min="1"
                    max="5"
                  />
                </div>
              </div>
            )}
          </div>
        </AdminCard>
      </div>

      {/* Delivery Zones */}
      <AdminCard title="Delivery Zones" subtitle="Manage service areas and zone-specific pricing">
        {/* Add New Zone */}
        <div className="border-b border-gray-200 pb-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Zone</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Zone Name"
              value={newZone.name}
              onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
              className="p-3 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Base Fee"
              value={newZone.baseFee}
              onChange={(e) => setNewZone(prev => ({ ...prev, baseFee: parseFloat(e.target.value) || 0 }))}
              className="p-3 border border-gray-300 rounded-lg"
            />
            <input
              type="number"
              placeholder="Free Delivery Threshold"
              value={newZone.freeDeliveryThreshold}
              onChange={(e) => setNewZone(prev => ({ ...prev, freeDeliveryThreshold: parseFloat(e.target.value) || 0 }))}
              className="p-3 border border-gray-300 rounded-lg"
            />
            <button
              onClick={handleAddZone}
              disabled={saving || !newZone.name}
              className={`px-4 py-3 rounded-lg font-medium ${
                saving || !newZone.name
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              } text-white`}
            >
              Add Zone
            </button>
          </div>
        </div>

        {/* Existing Zones */}
        <div className="space-y-4">
          {deliveryZones.map((zone) => (
            <div key={zone.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{zone.name}</h4>
                  <p className="text-sm text-gray-600">
                    Base Fee: ₹{zone.baseFee} • Free Delivery: ₹{zone.freeDeliveryThreshold}+
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    zone.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {zone.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>

      {/* Pricing Calculator Preview */}
      <AdminCard title="Pricing Calculator Preview" subtitle="Test how delivery fees are calculated">
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Example Calculation</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Order Value: ₹250 | Distance: 4.5 km | Time: 20:30 (Surge: 2.0x)</p>
              <div className="border-t border-gray-200 pt-2 mt-4">
                <p>Base Fee: ₹{pricingConfig.baseFee}</p>
                <p>Distance Fee (1.5 km × ₹5): ₹{(1.5 * 5).toFixed(0)}</p>
                <p>Surge Multiplier (2.0x): ₹{((pricingConfig.baseFee + 7.5) * 1.0).toFixed(0)}</p>
                <p className="font-semibold text-gray-900 border-t border-gray-300 pt-2 mt-2">
                  Total Delivery Fee: ₹{((pricingConfig.baseFee + 7.5) * 2.0).toFixed(0)}
                </p>
                <p className="text-xs">
                  Driver Earnings: ₹{(((pricingConfig.baseFee + 7.5) * 2.0) * (pricingConfig.driverEarningsPercentage / 100)).toFixed(0)} 
                  ({pricingConfig.driverEarningsPercentage}%)
                </p>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>
    </div>
  );
}