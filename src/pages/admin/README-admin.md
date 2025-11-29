# Admin Pages — Checklist & Runbook

Purpose: quick checklist for developing, testing and deploying the admin pages under src/pages/admin.

Status legend:
- [ ] Not started
- [~] In progress
- [x] Done

---

## Quick setup
- [ ] Node dependencies installed (npm install / yarn)
- [ ] Start dev server (npm run dev or npm start depending on project)
- [ ] Ensure Firebase credentials are configured in `src/firebase.js` and server endpoints are reachable

---

## Features implemented
- [x] Responsive AdminLayout (desktop sidebar + mobile header + slide-over drawer)
- [x] OrdersAdmin
  - [x] Date range filter (from / to)
  - [x] Quick filter: Last 7 days count
  - [x] Orders grid view with createdAt display
  - [x] Delete order with confirmation modal
- [x] ProductsAdmin
  - [x] List / Grid toggle
  - [x] Grid mode: responsive cards, 2-column on small/mobile
  - [x] Edit / Copy / Delete actions available

---

## Testing checklist (manual)

### OrdersAdmin
- [ ] Open Admin -> Orders page
- [ ] Verify orders load and the createdAt/date is visible on each card
- [ ] Use From/To inputs and validate filtering works
- [ ] Click "Last 7 days" and verify the count matches filtered results
- [ ] Delete an order and confirm it is removed from Firebase

### ProductsAdmin
- [ ] Toggle between List and Grid views
- [ ] On mobile widths verify grid becomes 2 columns
- [ ] Create/Edit/Delete product flows work and images persist
- [ ] Copy product duplicates data as expected

### AdminLayout / Navigation
- [ ] Mobile drawer opens/closes and navigation links work
- [ ] Desktop sidebar layout intact and not overlapping content

### Cross-checks
- [ ] Confirm modals (delete confirmations) show only single confirm action (no duplicate buttons)
- [ ] Confirm loaders and toasts display for long operations

---

## Checkout / Orders related flows (integration)
- [x] Centralized validations added in Checkout (normalizeAndValidateAddress)
- [x] WhatsApp order flow implemented (message builder + wa.me link)
- [x] Offline-fallback order save when payment gateway not configured
- [ ] Verify Razorpay flow in staging (success / failure cases)
- [ ] Decide and test whether Razorpay modal should be programmatically closed on failure
- [ ] Confirm whether to include Order ID in WhatsApp message prior to saving to DB

---

## Deployment checklist
- [ ] Ensure Firebase Realtime Database rules are correct and deployed
- [ ] Ensure server endpoint for creating Razorpay orders is configured and has correct keys
- [ ] Build and smoke-test admin pages after deployment

---

## Pending / Design decisions
- [ ] Consolidate admin helpers: user reverted a previously introduced single-file `adminHelpers.js`. Decide whether to reintroduce consolidated helpers or keep inline utilities.
- [ ] Phone input UX: currently phone is normalized to `+91XXXXXXXXXX` at submission. Decide whether to show `+91` in the input field permanently.
- [ ] WhatsApp order: choose whether to create order on server first to capture orderId, or send WhatsApp with provisional/offline order details.

---

## Troubleshooting & notes
- If orders or products don't show, check Firebase rules and network console for permission errors.
- If payments fail, inspect server logs for Razorpay key/configuration and validate the server create-order endpoint.
- If you see duplicate modal buttons, ensure the Modal component is not passed duplicate confirm/cancel props.

---

## Contacts
- Repository: griya-Ecom (branch: `jeweller`)
- Author: frontend admin tooling

