# Swiggy Clone - Food Delivery App Requirements

## 🏗️ **System Architecture Overview**
- **Customer App** - Food ordering interface
- **Restaurant Partner App** - Restaurant management & order handling
- **Delivery Partner App** - Delivery management & tracking
- **Admin Panel** - Platform management & analytics

---

## 🍕 **CUSTOMER APP FEATURES**

### **Authentication & Profile**
- [ ] Phone/Email registration & login
- [ ] OTP verification
- [ ] Social login (Google, Facebook)
- [ ] Profile management (name, photo, addresses)
- [ ] Multiple delivery addresses
- [ ] Wallet & payment methods

### **Restaurant Discovery & Search**
- [ ] Location-based restaurant listing
- [ ] Search by restaurant name, cuisine, dish
- [ ] Filter by: cuisine, price, rating, delivery time, offers
- [ ] Sort by: popularity, rating, delivery time, cost
- [ ] Restaurant categories (Pure Veg, Fast Delivery, etc.)
- [ ] Recently ordered / Favorites

### **Restaurant & Menu Browsing**
- [ ] Restaurant details (photos, ratings, reviews, info)
- [ ] Menu categories & items
- [ ] Item customization (size, add-ons, preferences)
- [ ] Item ratings & reviews
- [ ] Recommended/Popular items
- [ ] Search within restaurant menu

### **Cart & Ordering**
- [ ] Add/remove items from cart
- [ ] Item quantity management
- [ ] Apply coupons & discounts
- [ ] Dynamic delivery fee calculation based on distance
- [ ] Real-time delivery fee updates
- [ ] Tax calculation
- [ ] Order summary
- [ ] Special cooking instructions
- [ ] Contactless delivery option

### **Delivery Fee Calculation System**
- [ ] **Distance-based pricing**: Fee calculated from restaurant to customer address
- [ ] **Base delivery fee**: Minimum charge for orders within X km
- [ ] **Per-km charges**: Additional fee for every km beyond base distance
- [ ] **Surge pricing**: Dynamic pricing during peak hours/bad weather
- [ ] **Free delivery threshold**: No delivery fee above certain order value
- [ ] **Zone-based pricing**: Different rates for different service areas
- [ ] **Real-time calculation**: Updates when delivery address changes

### **Payment System**
- [ ] Multiple payment options (Card, UPI, Wallet, COD)
- [ ] Save payment methods
- [ ] Split bill functionality
- [ ] Refund processing
- [ ] Payment history

### **Order Management**
- [ ] Real-time order tracking
- [ ] Order status updates
- [ ] Estimated delivery time
- [ ] Live delivery partner tracking
- [ ] Order history
- [ ] Reorder functionality
- [ ] Order cancellation
- [ ] Rate & review orders

### **Notifications & Communication**
- [ ] Push notifications for order updates
- [ ] SMS notifications
- [ ] In-app messaging with delivery partner
- [ ] Call delivery partner
- [ ] Order confirmation notifications

### **Offers & Loyalty**
- [ ] Coupon codes
- [ ] Restaurant-specific offers
- [ ] Cashback offers
- [ ] Loyalty points system
- [ ] Referral program
- [ ] First-time user discounts

---

## 🏪 **RESTAURANT PARTNER APP FEATURES**

### **Restaurant Management**
- [ ] Restaurant registration & verification
- [ ] Restaurant profile setup (photos, timings, info)
- [ ] Multi-location management
- [ ] Restaurant status (Open/Closed)
- [ ] Holiday management

### **Menu Management**
- [ ] Add/edit/delete menu categories
- [ ] Add/edit/delete menu items
- [ ] Item photos & descriptions
- [ ] Pricing management
- [ ] Item availability toggle
- [ ] Bulk menu upload
- [ ] Seasonal menu management

### **Order Management**
- [ ] Incoming order notifications
- [ ] Order acceptance/rejection
- [ ] Order preparation time setting
- [ ] Order ready notification
- [ ] Order history & analytics
- [ ] Bulk order operations

### **Analytics & Reporting**
- [ ] Daily/weekly/monthly sales reports
- [ ] Popular items analysis
- [ ] Customer feedback & ratings
- [ ] Peak hours analysis
- [ ] Revenue tracking
- [ ] Order cancellation analytics

### **Customer Interaction**
- [ ] Respond to customer reviews
- [ ] Customer query handling
- [ ] Promotional campaigns
- [ ] Offer creation & management

### **Financial Management**
- [ ] Earnings dashboard
- [ ] Commission tracking
- [ ] Payout management
- [ ] Invoice generation
- [ ] Tax reporting

---

## 🛵 **DELIVERY PARTNER APP FEATURES**

### **Partner Management**
- [ ] Delivery partner registration
- [ ] Document verification (License, Aadhar, etc.)
- [ ] Profile management
- [ ] Vehicle details management
- [ ] Availability status toggle

### **Order Assignment & Management**
- [ ] Order assignment notifications
- [ ] Order acceptance/rejection
- [ ] Multiple order handling
- [ ] Route optimization
- [ ] Navigation integration (Google Maps)
- [ ] Order pickup confirmation
- [ ] Delivery confirmation

### **Real-time Tracking**
- [ ] GPS location tracking
- [ ] Real-time location sharing
- [ ] Route tracking
- [ ] ETA calculations
- [ ] Traffic-aware routing

### **Communication**
- [ ] Call customer functionality
- [ ] Call restaurant functionality
- [ ] In-app messaging
- [ ] Delivery instructions
- [ ] Photo proof of delivery

### **Earnings & Analytics**
- [ ] Daily earnings dashboard
- [ ] Trip history
- [ ] Distance tracking and route optimization
- [ ] Performance metrics
- [ ] Incentive tracking
- [ ] Weekly payouts
- [ ] **Distance-based earnings calculation**
- [ ] **Delivery fee breakdown** (base fee + distance charges)
- [ ] **Route efficiency metrics** (actual vs optimal distance)
- [ ] **Peak hour bonuses** for high-demand periods

### **Support & Safety**
- [ ] Emergency contact
- [ ] Report issues
- [ ] Safety features
- [ ] Insurance information
- [ ] Help & support

---

## ⚙️ **ADMIN PANEL FEATURES**

### **Dashboard & Analytics**
- [ ] Real-time order monitoring
- [ ] Platform-wide analytics
- [ ] Revenue dashboard
- [ ] User growth metrics
- [ ] Performance KPIs

### **User Management**
- [ ] Customer management
- [ ] Restaurant partner management
- [ ] Delivery partner management
- [ ] User verification
- [ ] Account suspension/activation

### **Order Management**
- [ ] Order monitoring & tracking
- [ ] Dispute resolution
- [ ] Refund processing
- [ ] Order analytics
- [ ] Issue escalation

### **Content Management**
- [ ] Banner management
- [ ] Promotional content
- [ ] City/area management
- [ ] Cuisine category management
- [ ] App configuration

### **Financial Management**
- [ ] Commission rate management
- [ ] Payout processing
- [ ] Financial reporting
- [ ] Tax management
- [ ] Pricing strategies

---

## 🛠️ **TECHNICAL REQUIREMENTS**

### **Core Technologies**
- [ ] **Frontend**: React.js with Vite
- [ ] **Mobile**: React Native or Flutter
- [ ] **Backend**: Node.js with Express
- [ ] **Database**: Cloud Firestore
- [ ] **Authentication**: Firebase Auth
- [ ] **File Storage**: Firebase Storage
- [ ] **Maps**: Google Maps API
- [ ] **Payments**: Razorpay/Stripe

### **Real-time Features**
- [ ] Firestore real-time listeners for order updates
- [ ] Real-time delivery tracking
- [ ] Live order status updates
- [ ] Push notifications via Firebase Cloud Messaging
- [ ] In-app messaging with Firestore

### **APIs & Integrations**
- [ ] Google Maps API (geocoding, directions)
- [ ] Google Distance Matrix API for delivery fee calculation
- [ ] Payment gateway integration
- [ ] SMS gateway for OTP
- [ ] Email service
- [ ] Push notification service
- [ ] Image optimization service

### **Delivery Fee Calculation Engine**
```javascript
// Delivery Fee Calculation Logic
const calculateDeliveryFee = async (restaurantLocation, customerLocation, orderValue, currentTime) => {
  // 1. Calculate distance using Google Distance Matrix API
  const distance = await getDistanceBetweenPoints(restaurantLocation, customerLocation);
  
  // 2. Get zone-specific pricing
  const zone = await getDeliveryZone(customerLocation);
  const pricing = zone.pricing;
  
  // 3. Calculate base components
  let deliveryFee = {
    baseFee: pricing.baseFee,
    distanceFee: 0,
    surgeFee: 0,
    totalFee: 0
  };
  
  // 4. Apply distance-based charges
  if (distance.km > 3) {
    const extraKm = distance.km - 3;
    deliveryFee.distanceFee = extraKm * pricing.perKmRate;
  }
  
  // 5. Apply surge pricing if during peak hours
  const surgeMultiplier = getSurgeMultiplier(currentTime, zone);
  if (surgeMultiplier > 1) {
    deliveryFee.surgeFee = deliveryFee.baseFee * (surgeMultiplier - 1);
  }
  
  // 6. Calculate total
  deliveryFee.totalFee = deliveryFee.baseFee + deliveryFee.distanceFee + deliveryFee.surgeFee;
  
  // 7. Apply free delivery threshold
  if (orderValue >= pricing.freeDeliveryThreshold) {
    deliveryFee.totalFee = 0;
    deliveryFee.discount = deliveryFee.baseFee + deliveryFee.distanceFee + deliveryFee.surgeFee;
  }
  
  // 8. Calculate driver earnings (80% of delivery fee)
  deliveryFee.driverEarnings = deliveryFee.totalFee * 0.8;
  deliveryFee.platformFee = deliveryFee.totalFee * 0.2;
  
  return deliveryFee;
};
```

### **Performance & Scalability**
- [ ] CDN for image delivery
- [ ] Firestore compound indexes
- [ ] Firestore security rules
- [ ] Caching strategies
- [ ] Load balancing
- [ ] API rate limiting
- [ ] Error logging & monitoring

---

## 📊 **FIRESTORE DATABASE SCHEMA**

### **Core Collections**
```
users/ (collection)
  {userId}/ (document)
    - profile: { name, email, phone, avatar }
    - addresses: [{ id, label, address, coordinates, isDefault }]
    - paymentMethods: [{ id, type, details }]
    - preferences: { cuisine, dietary }
    - createdAt, updatedAt

    orders/ (subcollection)
      {orderId}/ (document)
        - restaurantId, items[], status, total, timeline[]

restaurants/ (collection)  
  {restaurantId}/ (document)
    - profile: { name, description, cuisine, photos[], contactInfo }
    - location: { address, coordinates, serviceAreas[] }
    - timings: { open, close, breaks[] }
    - ratings: { average, count }
    - status: "active" | "inactive" | "temporarily_closed"
    - createdAt, updatedAt

    menu/ (subcollection)
      {categoryId}/ (document)
        - name, description, sortOrder
        
        items/ (subcollection)
          {itemId}/ (document)
            - name, description, price, images[], customizations[]
            - isVeg, isAvailable, preparationTime

deliveryPartners/ (collection)
  {partnerId}/ (document)
    - profile: { name, email, phone, photo }
    - vehicle: { type, number, documents[] }
    - location: { current: coordinates, lastUpdated }
    - status: "online" | "offline" | "busy"
    - ratings: { average, count }
    - earnings: { today, week, month }

orders/ (collection)
  {orderId}/ (document)
    - customerId, restaurantId, deliveryPartnerId
    - items: [{ itemId, quantity, price, customizations }]
    - status: "placed" | "accepted" | "preparing" | "ready" | "picked" | "delivered" | "cancelled"
    - payment: { method, status, amount, transactionId }
    - addresses: { 
        pickup: { restaurant, coordinates, address }, 
        delivery: { customer, coordinates, address }
      }
    - distance: {
        totalKm: number,
        estimatedKm: number,
        actualKm: number,
        calculatedAt: timestamp
      }
    - deliveryFee: {
        baseFee: number,
        distanceFee: number,
        surgeFee: number,
        totalFee: number,
        driverEarnings: number,
        platformFee: number
      }
    - timeline: [{ status, timestamp, notes }]
    - totals: { subtotal, tax, deliveryFee, discount, grandTotal }
    - createdAt, updatedAt

deliveryZones/ (collection)
  {zoneId}/ (document)
    - name: string
    - coordinates: [{ lat, lng }] // polygon boundaries
    - pricing: {
        baseFee: number,
        freeDeliveryThreshold: number,
        perKmRate: number,
        maxDistance: number,
        surgeMultiplier: number
      }
    - isActive: boolean

deliveryPricing/ (collection)
  {configId}/ (document)
    - baseFee: number
    - freeDeliveryThreshold: number
    - perKmRates: [
        { maxKm: 3, rate: 0 },      // Free up to 3km
        { maxKm: 5, rate: 5 },      // ₹5 per km for 3-5km
        { maxKm: 10, rate: 8 },     // ₹8 per km for 5-10km
        { maxKm: 999, rate: 12 }    // ₹12 per km beyond 10km
      ]
    - surgeHours: [
        { start: "12:00", end: "14:00", multiplier: 1.5 },
        { start: "19:00", end: "22:00", multiplier: 2.0 }
      ]
    - driverEarningsPercentage: 80 // Driver gets 80% of delivery fee

locations/ (collection)
  {locationId}/ (document)
    - coordinates: { lat, lng }
    - address: { formatted, components }
    - serviceability: boolean
    - deliveryZone: string

offers/ (collection)
  {offerId}/ (document)
    - title, description, type, value
    - conditions: { minOrder, applicableRestaurants[], userType }
    - validity: { from, to }
    - usage: { limit, used }

reviews/ (collection)
  {reviewId}/ (document)
    - orderId, userId, restaurantId, deliveryPartnerId
    - rating, comment, photos[]
    - createdAt

notifications/ (collection)
  {notificationId}/ (document)
    - userId, type, title, message
    - data: { orderId, restaurantId }
    - isRead, createdAt
```

### **Firestore Indexes Required**
```
// Composite indexes for efficient querying
restaurants:
  - location.coordinates (geo) + status + ratings.average
  - cuisine + status + ratings.average
  - status + location.serviceAreas

orders:
  - customerId + status + createdAt (desc)
  - restaurantId + status + createdAt (desc)  
  - deliveryPartnerId + status + createdAt (desc)
  - status + createdAt (desc)

reviews:
  - restaurantId + createdAt (desc)
  - deliveryPartnerId + createdAt (desc)

notifications:
  - userId + isRead + createdAt (desc)
```

### **Firestore Security Rules**
```javascript
// Users can only access their own data
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
  
  match /orders/{orderId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
}

// Restaurants can only access their own data
match /restaurants/{restaurantId} {
  allow read: if true; // Public read for discovery
  allow write: if request.auth != null && 
               request.auth.token.restaurantId == restaurantId;
}

// Orders have specific access patterns
match /orders/{orderId} {
  allow read: if request.auth != null && 
              (resource.data.customerId == request.auth.uid ||
               resource.data.restaurantId == request.auth.token.restaurantId ||
               resource.data.deliveryPartnerId == request.auth.uid);
  
  allow create: if request.auth != null;
  allow update: if request.auth != null &&
                (resource.data.restaurantId == request.auth.token.restaurantId ||
                 resource.data.deliveryPartnerId == request.auth.uid);
}
```

---

## 🔄 **ORDER WORKFLOW**

### **Customer Journey**
1. Browse restaurants → Select items → Add to cart
2. Apply offers → Choose payment → Place order
3. Track order → Receive delivery → Rate experience

### **Merchant Journey**
1. Receive order → Accept/Reject → Prepare food
2. Mark ready → Broadcast to delivery partners

### **Delivery Journey**
1. See ready orders → Accept → Navigate to restaurant
2. Pick up order → Navigate to customer → Deliver
3. Confirm delivery → Update earnings

### **Order States**
- **Pending** → Customer placed, waiting merchant approval
- **Confirmed** → Merchant accepted, starting preparation  
- **Preparing** → Merchant preparing food
- **Ready** → Merchant packed, broadcasted to drivers
- **Assigned** → Driver accepted and heading to pickup
- **Picked** → Driver picked up from merchant
- **In-Transit** → Driver heading to customer
- **Delivered** → Successfully completed

### **Key Rule: Drivers only see orders after merchant marks as "Ready"**

---

## 🎯 **MVP FEATURES (Phase 1)**

### **Customer App MVP**
- [ ] Restaurant listing & search
- [ ] Menu browsing & ordering
- [ ] Basic payment (COD + Online)
- [ ] Order tracking
- [ ] User registration/login

### **Restaurant App MVP**  
- [ ] Order management
- [ ] Menu management
- [ ] Basic analytics
- [ ] Order acceptance/rejection

### **Delivery App MVP**
- [ ] Order assignment
- [ ] Basic navigation
- [ ] Order pickup/delivery
- [ ] Earnings tracking

### **Admin Panel MVP**
- [ ] Order monitoring
- [ ] User management
- [ ] Basic analytics
- [ ] Content management

---

## 🚀 **IMPLEMENTATION PHASES**

### **Phase 1: Core MVP (2-3 months)**
- Basic ordering system
- Restaurant & delivery partner onboarding
- Essential features only

### **Phase 2: Enhanced Features (1-2 months)**
- Advanced search & filters
- Real-time tracking
- Ratings & reviews
- Offer management

### **Phase 3: Advanced Features (1-2 months)**
- Analytics dashboards
- Loyalty programs
- Advanced payment options
- Performance optimization

### **Phase 4: Scale & Optimize (Ongoing)**
- Multi-city expansion
- Advanced algorithms
- AI recommendations
- Business intelligence

---

## 💰 **MONETIZATION MODEL**

- **Commission from restaurants** (15-25% per order)
- **Delivery charges** from customers  
- **Advertising revenue** from restaurants
- **Premium subscriptions** (free delivery)
- **Payment gateway commissions**

---

This comprehensive document covers all major functionality needed for a complete Swiggy-like food delivery ecosystem. Each feature should be prioritized based on MVP requirements and development timeline.