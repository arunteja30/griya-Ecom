# Delivery Fee & Merchant Earnings Calculation Documentation

This document explains how delivery fees and merchant earnings are calculated in the Griya E-commerce platform, with real-world examples and admin controls.

## Table of Contents
1. [Delivery Fee Calculation](#delivery-fee-calculation)
2. [Merchant Earnings Calculation](#merchant-earnings-calculation)
3. [Example Transactions](#example-transactions)
4. [Admin Controls](#admin-controls)
5. [Real-time Synchronization](#real-time-synchronization)

---

## Delivery Fee Calculation

### Base Configuration
```javascript
const DEFAULT_PRICING = {
  deliveryFeeEnabled: true,
  globalFreeDelivery: false,
  useAdminOverride: false,
  adminOverrideFee: 0,
  baseDeliveryFee: 40,
  feePerKm: 15,
  feePerKmAbove5: 20,
  minOrderForFreeDelivery: 500,
  driverEarningsPercentage: 80
}
```

### Calculation Priority (Admin Controls Override Everything)

1. **Delivery Fees Disabled** → ₹0
2. **Global Free Delivery** → ₹0  
3. **Scheduled Free Delivery** → ₹0
4. **Fixed Admin Override** → Set amount
5. **Order Above Free Delivery Threshold** → ₹0
6. **Distance-Based Calculation** → Formula below

### Distance-Based Formula
```
Total Delivery Fee = Base Fee + Distance Fee

Where:
- Base Fee = ₹40 (configurable)
- Distance Fee = 
  * First 5km: distance × ₹15/km
  * Above 5km: 5 × ₹15 + (distance-5) × ₹20/km
```

### Driver Earnings from Delivery Fee
```
Driver Earnings = Delivery Fee × 80% (configurable)
Platform Share = Delivery Fee × 20%
```

---

## Merchant Earnings Calculation

### Base Configuration
```javascript
const DEFAULT_MERCHANT_EARNINGS = {
  commissionPercentage: 15,        // Platform commission
  deliveryFeeShare: 10,           // % of delivery fee merchant gets
  minimumPayout: 100,             // Minimum amount for payout
  payoutSchedule: 'weekly',       // daily, weekly, monthly
  bonusEarnings: {
    enabled: false,
    orderVolumeBonus: 5,          // ₹ per order above threshold
    volumeThreshold: 100,         // Orders per month
    qualityRating: 4.5,           // Min rating for bonus
    qualityBonus: 5               // % bonus for high rating
  },
  peakHourBonus: {
    enabled: true,
    hours: [
      { start: '12:00', end: '14:00', bonus: 10 }, // Lunch: +10%
      { start: '19:00', end: '22:00', bonus: 15 }  // Dinner: +15%
    ]
  }
}
```

### Calculation Formula
```
Base Merchant Earning = Order Value - Platform Commission + Delivery Share
Peak Hour Bonus = Base Earning × Peak Bonus %
Total Merchant Earning = Base Earning + Peak Hour Bonus

Where:
- Platform Commission = Order Value × Commission %
- Delivery Share = Delivery Fee × Delivery Share %
```

---

## Example Transactions

### Example 1: Regular Order (No Admin Overrides)
**Order Details:**
- Order Value: ₹450
- Distance: 3.2 km
- Time: 10:30 AM (non-peak)
- Customer: Regular customer

**Delivery Fee Calculation:**
```
Base Fee: ₹40
Distance Fee: 3.2 km × ₹15/km = ₹48
Total Delivery Fee: ₹40 + ₹48 = ₹88

Driver Earnings: ₹88 × 80% = ₹70.40
Platform Share: ₹88 × 20% = ₹17.60
```

**Merchant Earnings Calculation:**
```
Platform Commission: ₹450 × 15% = ₹67.50
Delivery Share: ₹88 × 10% = ₹8.80
Base Merchant Earning: ₹450 - ₹67.50 + ₹8.80 = ₹391.30
Peak Hour Bonus: ₹0 (not peak time)
Total Merchant Earning: ₹391.30
```

**Final Breakdown:**
- Customer Pays: ₹450 (order) + ₹88 (delivery) + ₹15 (platform fee) = **₹553**
- Merchant Receives: **₹391.30**
- Driver Receives: **₹70.40**
- Platform Receives: ₹67.50 + ₹17.60 + ₹15 = **₹100.10**

---

### Example 2: Peak Hour Order with Admin Override
**Order Details:**
- Order Value: ₹320
- Distance: 7.5 km
- Time: 8:30 PM (dinner rush)
- Admin Override: Fixed delivery fee ₹50

**Delivery Fee Calculation:**
```
Admin Override Active: ₹50 (ignores distance)

Driver Earnings: ₹50 × 80% = ₹40
Platform Share: ₹50 × 20% = ₹10
```

**Merchant Earnings Calculation:**
```
Platform Commission: ₹320 × 15% = ₹48
Delivery Share: ₹50 × 10% = ₹5
Base Merchant Earning: ₹320 - ₹48 + ₹5 = ₹277
Peak Hour Bonus: ₹277 × 15% = ₹41.55
Total Merchant Earning: ₹277 + ₹41.55 = ₹318.55
```

**Final Breakdown:**
- Customer Pays: ₹320 + ₹50 + ₹15 = **₹385**
- Merchant Receives: **₹318.55**
- Driver Receives: **₹40**
- Platform Receives: ₹48 + ₹10 + ₹15 = **₹73**

---

### Example 3: Free Delivery (Above Threshold)
**Order Details:**
- Order Value: ₹650
- Distance: 4.8 km
- Time: 1:15 PM (lunch rush)

**Delivery Fee Calculation:**
```
Order above ₹500 threshold: ₹0 delivery fee
Driver Earnings: ₹0
Platform Share: ₹0
```

**Merchant Earnings Calculation:**
```
Platform Commission: ₹650 × 15% = ₹97.50
Delivery Share: ₹0 × 10% = ₹0
Base Merchant Earning: ₹650 - ₹97.50 + ₹0 = ₹552.50
Peak Hour Bonus: ₹552.50 × 10% = ₹55.25
Total Merchant Earning: ₹552.50 + ₹55.25 = ₹607.75
```

**Final Breakdown:**
- Customer Pays: ₹650 + ₹0 + ₹15 = **₹665**
- Merchant Receives: **₹607.75**
- Driver Receives: **₹0** (no delivery needed or separate payment)
- Platform Receives: ₹97.50 + ₹15 = **₹112.50**

---

### Example 4: Global Free Delivery Campaign
**Order Details:**
- Order Value: ₹280
- Distance: 6.2 km
- Admin: Global free delivery active
- Time: 9:45 PM (dinner rush)

**Delivery Fee Calculation:**
```
Global Free Delivery Override: ₹0
Driver Earnings: ₹0 (platform compensates separately)
Platform Share: ₹0
```

**Merchant Earnings Calculation:**
```
Platform Commission: ₹280 × 15% = ₹42
Delivery Share: ₹0 × 10% = ₹0
Base Merchant Earning: ₹280 - ₹42 + ₹0 = ₹238
Peak Hour Bonus: ₹238 × 15% = ₹35.70
Total Merchant Earning: ₹238 + ₹35.70 = ₹273.70
```

**Final Breakdown:**
- Customer Pays: ₹280 + ₹0 + ₹15 = **₹295**
- Merchant Receives: **₹273.70**
- Driver Receives: **₹0** (platform bears cost)
- Platform Receives: ₹42 + ₹15 = **₹57** (absorbs delivery cost)

---

## Admin Controls

### Delivery Fee Controls
1. **Enable/Disable Delivery Fees**
   - `deliveryFeeEnabled: false` → All delivery fees = ₹0

2. **Global Free Delivery**
   - `globalFreeDelivery: true` → All deliveries free

3. **Fixed Fee Override** 
   - `useAdminOverride: true, adminOverrideFee: 60` → All deliveries = ₹60

4. **Scheduled Campaigns**
   ```javascript
   freeDeliverySchedule: {
     enabled: true,
     startDate: '2026-01-05T00:00:00Z',
     endDate: '2026-01-07T23:59:59Z',
     reason: 'New Year Special'
   }
   ```

### Merchant Earnings Controls (Per Merchant)
1. **Commission Rates**: 10%-25% typical range
2. **Delivery Share**: 0%-25% of delivery fee
3. **Peak Hour Bonuses**: Time-based percentage bonuses
4. **Quality Bonuses**: Rating and volume-based rewards
5. **Payout Schedule**: Daily, weekly, or monthly

---

## Real-time Synchronization

### Firebase Structure
```
/deliveryPricing/default
├── deliveryFeeEnabled: true
├── globalFreeDelivery: false
├── useAdminOverride: false
├── adminOverrideFee: 0
└── driverEarningsPercentage: 80

/merchantEarnings/{merchantId}
├── commissionPercentage: 15
├── deliveryFeeShare: 10
├── peakHourBonus: {...}
└── bonusEarnings: {...}

/orders/{orderId}
├── merchantEarnings: {
│   ├── totalEarning: 391.30
│   ├── breakdown: {...}
│   └── peakHourBonus: 0
│ }
└── merchantPaid: false
```

### Real-time Updates
- **Admin changes** → Immediate reflection in all apps
- **Firebase listeners** → No page refresh required  
- **Order calculations** → Use latest config at order time
- **Merchant dashboards** → Live earnings updates

### API Integration Points
1. **Cart/Checkout**: `estimateDeliveryFee(orderTotal, distance)`
2. **Order Creation**: `calculateMerchantEarnings(orderData, earningsConfig)`
3. **Driver App**: `calculateDriverEarnings(deliveryFee, config)`
4. **Admin Panel**: Real-time configuration management

---

## Monthly Bonus Calculation Example

### Merchant Performance Data (January 2026)
- Total Orders: 150
- Average Rating: 4.7/5
- Total Monthly Earnings: ₹45,000
- Volume Threshold: 100 orders
- Quality Rating Threshold: 4.5

### Bonus Calculation
```javascript
// Volume Bonus
extraOrders = 150 - 100 = 50 orders
volumeBonus = 50 × ₹5 = ₹250

// Quality Bonus (4.7 ≥ 4.5)
qualityBonus = ₹45,000 × 5% = ₹2,250

// Total Monthly Bonus
totalBonus = ₹250 + ₹2,250 = ₹2,500
```

### Final Monthly Earnings
- Base Earnings: ₹45,000
- Volume Bonus: ₹250
- Quality Bonus: ₹2,250
- **Total: ₹47,500**

---

## Integration Notes

### For Developers
1. **Always use real-time config**: Subscribe to Firebase listeners
2. **Cache config appropriately**: Avoid excessive Firebase calls
3. **Handle failures gracefully**: Don't block orders if earnings calculation fails
4. **Validate admin inputs**: Ensure commission rates are reasonable
5. **Test edge cases**: Zero orders, negative values, invalid times

### For Business Operations
1. **Monitor merchant satisfaction**: Track earnings vs. expectations
2. **Adjust commission rates**: Based on market conditions
3. **Use promotional campaigns**: Scheduled free delivery for marketing
4. **Analyze peak patterns**: Optimize bonus hours for demand
5. **Regular payout processing**: Ensure timely merchant payments

This system provides complete transparency and Swiggy-level functionality for both delivery fees and merchant earnings.