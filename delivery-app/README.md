# Griya Delivery App

A standalone delivery partner application for managing order pickups and deliveries.

## Features

- **Authentication**: Secure login for delivery partners
- **Order Management**: View available orders, accept assignments, track progress
- **Status Updates**: Real-time order status updates (assigned → picked → in-transit → delivered)
- **Customer Communication**: Direct calling and address mapping integration
- **Profile Management**: Update availability status and view performance metrics

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Update Firebase Configuration:**
   - Edit `src/firebase.js` with your Firebase project credentials
   - Ensure the database URL matches your main e-commerce app

3. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will run on `http://localhost:3001`

4. **Build for production:**
   ```bash
   npm run build
   ```

## Demo Login Credentials

- **ID**: DEL001, **Password**: delivery123 (John Doe - Bike)
- **ID**: DEL002, **Password**: delivery123 (Jane Smith - Bike)  
- **ID**: DEL003, **Password**: delivery123 (Mike Johnson - Car)

## Order Flow (Swiggy-like Workflow)

1. **Customer Places Order**: Order created with 'pending' status
2. **Merchant Accepts**: Order becomes 'confirmed' and 'preparing'
3. **Merchant Packs**: Order marked as 'ready' and broadcasted to all delivery partners
4. **Driver Sees & Accepts**: Available orders appear only when 'ready', partner accepts and status becomes 'assigned'
5. **Mark as Picked**: Partner picks up from store, status becomes 'picked'
6. **Start Delivery**: Partner starts delivery, status becomes 'in-transit'
7. **Mark as Delivered**: Order completion, status becomes 'delivered'

**Key Feature**: Drivers only see orders AFTER merchant marks them as ready (packed)

## Integration with Main App

The delivery app connects to the same Firebase database as your main e-commerce application:

- Reads orders from `/orders` node
- Updates order status and delivery person information
- Maintains order timeline with timestamps

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Database**: Firebase Realtime Database (shared with main app)
- **Routing**: React Router DOM
- **State Management**: React hooks + localStorage

## File Structure

```
delivery-app/
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.jsx
│   │   └── ToastContainer.jsx
│   ├── pages/
│   │   ├── DeliveryLogin.jsx
│   │   ├── Dashboard.jsx
│   │   ├── OrderDetails.jsx
│   │   └── Profile.jsx
│   ├── utils/
│   │   └── toast.js
│   ├── App.jsx
│   ├── firebase.js
│   └── main.jsx
├── package.json
├── vite.config.js
└── tailwind.config.js
```