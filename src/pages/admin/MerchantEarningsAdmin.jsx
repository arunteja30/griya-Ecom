import React, { useState, useEffect } from 'react';
import { ref, get, set, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { showToast } from '../../components/Toast';

const AdminCard = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-gray-600 text-sm mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const DEFAULT_MERCHANT_EARNINGS = {
  commissionPercentage: 15, // Platform commission
  deliveryFeeShare: 10, // Percentage of delivery fee merchant gets
  minimumPayout: 100,
  payoutSchedule: 'weekly', // daily, weekly, monthly
  bonusEarnings: {
    enabled: false,
    orderVolumeBonus: 0, // Bonus per order after threshold
    volumeThreshold: 100, // Orders per month
    qualityRating: 4.5, // Minimum rating for bonus
    qualityBonus: 5 // Percentage bonus for high rating
  },
  peakHourBonus: {
    enabled: false,
    hours: [
      { start: '12:00', end: '14:00', bonus: 10 }, // Lunch
      { start: '19:00', end: '22:00', bonus: 15 }  // Dinner
    ]
  },
  enabled: true
};

export default function MerchantEarningsAdmin() {
  const [merchants, setMerchants] = useState({});
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [earningsConfig, setEarningsConfig] = useState(DEFAULT_MERCHANT_EARNINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMerchants();
  }, []);

  useEffect(() => {
    if (selectedMerchant) {
      loadMerchantEarnings(selectedMerchant);
    }
  }, [selectedMerchant]);

  const loadMerchants = async () => {
    try {
      const merchantsRef = ref(db, '/merchants');
      const snapshot = await get(merchantsRef);
      
      if (snapshot.exists()) {
        const merchantsData = snapshot.val();
        setMerchants(merchantsData);
        
        // Select first merchant by default
        const firstMerchantId = Object.keys(merchantsData)[0];
        if (firstMerchantId) {
          setSelectedMerchant(firstMerchantId);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading merchants:', error);
      setLoading(false);
    }
  };

  const loadMerchantEarnings = async (merchantId) => {
    try {
      const earningsRef = ref(db, `/merchantEarnings/${merchantId}`);
      const snapshot = await get(earningsRef);
      
      if (snapshot.exists()) {
        setEarningsConfig({ ...DEFAULT_MERCHANT_EARNINGS, ...snapshot.val() });
      } else {
        setEarningsConfig(DEFAULT_MERCHANT_EARNINGS);
      }
    } catch (error) {
      console.error('Error loading merchant earnings:', error);
      showToast.error('Error loading earnings configuration');
    }
  };

  const saveMerchantEarnings = async () => {
    if (!selectedMerchant) return;
    
    setSaving(true);
    try {
      const earningsRef = ref(db, `/merchantEarnings/${selectedMerchant}`);
      await set(earningsRef, {
        ...earningsConfig,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'admin'
      });
      
      showToast.success('Merchant earnings configuration saved successfully');
    } catch (error) {
      console.error('Error saving merchant earnings:', error);
      showToast.error('Error saving earnings configuration');
    }
    setSaving(false);
  };

  const calculateEstimatedEarnings = () => {
    const orderValue = 500; // Example order
    const deliveryFee = 40;
    
    const commission = (orderValue * earningsConfig.commissionPercentage) / 100;
    const deliveryShare = (deliveryFee * earningsConfig.deliveryFeeShare) / 100;
    const merchantEarning = orderValue - commission + deliveryShare;
    
    return {
      orderValue,
      deliveryFee,
      commission,
      deliveryShare,
      merchantEarning
    };
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const earnings = calculateEstimatedEarnings();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Merchant Earnings Management</h1>
          <p className="text-gray-600 mt-1">Configure earnings, commissions and bonuses for each merchant</p>
        </div>
        <button
          onClick={saveMerchantEarnings}
          disabled={saving || !selectedMerchant}
          className={`px-6 py-3 rounded-lg font-medium ${
            saving || !selectedMerchant
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-primary-600 hover:bg-primary-700'
          } text-white`}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Real-time Sync Notice */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-green-900">Real-time Merchant Sync</h4>
            <p className="text-sm text-green-700">
              Earnings changes will immediately reflect in merchant apps and order calculations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Merchant Selection */}
        <div className="lg:col-span-1">
          <AdminCard title="Select Merchant" subtitle="Choose merchant to configure earnings">
            <div className="space-y-2">
              {Object.entries(merchants).map(([id, merchant]) => (
                <button
                  key={id}
                  onClick={() => setSelectedMerchant(id)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedMerchant === id
                      ? 'bg-primary-50 border-primary-200 text-primary-900'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="font-medium">{merchant.businessName || 'Unnamed Merchant'}</div>
                  <div className="text-sm text-gray-600">{merchant.email}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ID: {id}
                  </div>
                </button>
              ))}
            </div>
          </AdminCard>

          {/* Earnings Preview */}
          <AdminCard title="Earnings Preview" subtitle="Example calculation for ₹500 order">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Order Value:</span>
                <span className="font-medium">₹{earnings.orderValue}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Platform Commission ({earningsConfig.commissionPercentage}%):</span>
                <span>-₹{earnings.commission}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Delivery Share ({earningsConfig.deliveryFeeShare}%):</span>
                <span>+₹{earnings.deliveryShare}</span>
              </div>
              <hr />
              <div className="flex justify-between font-semibold text-lg">
                <span>Merchant Earning:</span>
                <span className="text-green-600">₹{earnings.merchantEarning.toFixed(2)}</span>
              </div>
            </div>
          </AdminCard>
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          {selectedMerchant ? (
            <div className="space-y-6">
              {/* Basic Earnings Configuration */}
              <AdminCard title="Basic Earnings Configuration" subtitle="Commission and delivery fee sharing">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Platform Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={earningsConfig.commissionPercentage}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        commissionPercentage: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-600 mt-1">Percentage deducted from each order</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Fee Share (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="5"
                      value={earningsConfig.deliveryFeeShare}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        deliveryFeeShare: parseFloat(e.target.value) || 0
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-600 mt-1">Percentage of delivery fee merchant receives</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Payout Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="50"
                      step="10"
                      value={earningsConfig.minimumPayout}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        minimumPayout: parseFloat(e.target.value) || 100
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payout Schedule
                    </label>
                    <select
                      value={earningsConfig.payoutSchedule}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        payoutSchedule: e.target.value
                      }))}
                      className="w-full p-3 border border-gray-300 rounded-lg"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </AdminCard>

              {/* Bonus Earnings */}
              <AdminCard title="Bonus Earnings" subtitle="Volume and quality-based bonuses">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={earningsConfig.bonusEarnings.enabled}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        bonusEarnings: {
                          ...prev.bonusEarnings,
                          enabled: e.target.checked
                        }
                      }))}
                      className="h-5 w-5 text-primary-600"
                    />
                    <label className="font-medium">Enable Bonus Earnings</label>
                  </div>

                  {earningsConfig.bonusEarnings.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Volume Threshold (orders/month)
                        </label>
                        <input
                          type="number"
                          value={earningsConfig.bonusEarnings.volumeThreshold}
                          onChange={(e) => setEarningsConfig(prev => ({
                            ...prev,
                            bonusEarnings: {
                              ...prev.bonusEarnings,
                              volumeThreshold: parseInt(e.target.value) || 0
                            }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bonus per Extra Order (₹)
                        </label>
                        <input
                          type="number"
                          value={earningsConfig.bonusEarnings.orderVolumeBonus}
                          onChange={(e) => setEarningsConfig(prev => ({
                            ...prev,
                            bonusEarnings: {
                              ...prev.bonusEarnings,
                              orderVolumeBonus: parseFloat(e.target.value) || 0
                            }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Minimum Rating for Quality Bonus
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          value={earningsConfig.bonusEarnings.qualityRating}
                          onChange={(e) => setEarningsConfig(prev => ({
                            ...prev,
                            bonusEarnings: {
                              ...prev.bonusEarnings,
                              qualityRating: parseFloat(e.target.value) || 4.5
                            }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quality Bonus (%)
                        </label>
                        <input
                          type="number"
                          value={earningsConfig.bonusEarnings.qualityBonus}
                          onChange={(e) => setEarningsConfig(prev => ({
                            ...prev,
                            bonusEarnings: {
                              ...prev.bonusEarnings,
                              qualityBonus: parseFloat(e.target.value) || 0
                            }
                          }))}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AdminCard>

              {/* Peak Hour Bonus */}
              <AdminCard title="Peak Hour Bonus" subtitle="Additional earnings during busy hours">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={earningsConfig.peakHourBonus.enabled}
                      onChange={(e) => setEarningsConfig(prev => ({
                        ...prev,
                        peakHourBonus: {
                          ...prev.peakHourBonus,
                          enabled: e.target.checked
                        }
                      }))}
                      className="h-5 w-5 text-primary-600"
                    />
                    <label className="font-medium">Enable Peak Hour Bonus</label>
                  </div>

                  {earningsConfig.peakHourBonus.enabled && (
                    <div className="space-y-3">
                      {earningsConfig.peakHourBonus.hours.map((hour, index) => (
                        <div key={index} className="grid grid-cols-3 gap-3 items-end">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={hour.start}
                              onChange={(e) => {
                                const newHours = [...earningsConfig.peakHourBonus.hours];
                                newHours[index].start = e.target.value;
                                setEarningsConfig(prev => ({
                                  ...prev,
                                  peakHourBonus: {
                                    ...prev.peakHourBonus,
                                    hours: newHours
                                  }
                                }));
                              }}
                              className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={hour.end}
                              onChange={(e) => {
                                const newHours = [...earningsConfig.peakHourBonus.hours];
                                newHours[index].end = e.target.value;
                                setEarningsConfig(prev => ({
                                  ...prev,
                                  peakHourBonus: {
                                    ...prev.peakHourBonus,
                                    hours: newHours
                                  }
                                }));
                              }}
                              className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Bonus (%)
                            </label>
                            <input
                              type="number"
                              value={hour.bonus}
                              onChange={(e) => {
                                const newHours = [...earningsConfig.peakHourBonus.hours];
                                newHours[index].bonus = parseFloat(e.target.value) || 0;
                                setEarningsConfig(prev => ({
                                  ...prev,
                                  peakHourBonus: {
                                    ...prev.peakHourBonus,
                                    hours: newHours
                                  }
                                }));
                              }}
                              className="w-full p-2 border border-gray-300 rounded-lg"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AdminCard>
            </div>
          ) : (
            <AdminCard title="No Merchant Selected" subtitle="Please select a merchant to configure earnings">
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2v8h12V6H4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-gray-600">Select a merchant from the left panel to begin configuration</p>
              </div>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}