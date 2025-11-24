# Griya Admin — User Manual

This document explains each admin screen and field, how to use them, and provides examples.

---

## Access & roles

- Admin pages require Firebase Auth admin credentials.
- Login via the Admin Login screen; only authenticated users can access admin routes.

---

## Site Settings (`/admin/site-settings`)
Purpose: global site configuration (branding, contact, fees, banner).

Fields and usage

- `brandName` — site brand shown in header.
  - Example: `Griya Jewels`
- `tagline` — short tagline under logo.
  - Example: `Handcrafted Jewellery`
- `logoUrl` — image URL for logo.
  - Example: `https://cdn.example.com/logo.png`

Banner settings

- `bannerOffers` (textarea) — one offer per line. These rotate in the TopBanner and take precedence over `bannerText`.
  - Example lines:
    - `Flat 15% off — use code GRIYA15`
    - `Free shipping on orders > ₹5,000`
- `bannerText` — fallback single-line banner message if `bannerOffers` is empty.
  - Example: `Festive sale — up to 25% off`
- `bannerLink` — optional URL to open when banner clicked.
  - Example: `https://griya.example.com/sale`
- `bannerBgColor` — either a CSS hex (e.g. `#df2121`) or a Tailwind class (e.g. `bg-orange-500`).
  - If a hex is provided, the banner uses that hex as an inline background color.
  - If a Tailwind class is provided, that class is applied as the banner background.
- `bannerTextColor` — text color (Tailwind class like `text-white` or a hex like `#000000`).
- `bannerVisible` — checkbox to show/hide the banner immediately.

Contact & footer

- `whatsapp` — WhatsApp number used for messages.
- `instagram` — Instagram URL.
- `address` — store address.
- `footerText` — footer copy.

Fees

- `platformFee` — flat amount in INR added to orders (number).
- `surgeFee` — flat amount in INR (number).
- `otherFee` — flat amount (number).
- `deliveryFee` — flat delivery charge in INR.
- `freeDeliveryMin` — order subtotal threshold for free delivery.

Notes

- All fee fields are saved as numbers. Leave blank or set `0` to disable.
- Checkout computes `totalWithFees = subtotal + platformFee + surgeFee + otherFee + effectiveDeliveryFee` (delivery fee set to 0 when subtotal ≥ `freeDeliveryMin`).

Save behavior

- Click Save; numeric fields will be coerced to numbers.
- `bannerOffers` is saved as `offers` (array).
- `bannerVisible` saved as boolean.

Example: Start a promotional banner

- `bannerOffers`:
  - `Festive sale - 20% off`
- `bannerLink`: `https://griya.example.com/offers`
- `bannerBgColor`: `#df2121`
- `bannerTextColor`: `text-white`
- `bannerVisible`: checked

---

## Categories Admin (`/admin/categories`)
Purpose: create/edit/delete product categories.

Fields

- `name` — category display name. Example: `Necklaces`.
- `slug` — URL-friendly id. Auto-generated from name but editable. Example: `necklaces`.
- `imageUrl` — image for category card.

Tips

- Use unique slugs; duplicates can confuse product-category mapping.
- Image size: ~800×600 px recommended.

---

## Products Admin (`/admin/products`)
Purpose: manage products (CRUD, stock, categories).

Fields & usage

- `name` — product title. Example: `Gold Pendant`.
- `slug` — URL-friendly id used in product URLs. Auto-suggested from name; ensure uniqueness.
- `price` — selling price (INR).
- `mrp` — displayed MRP (optional).
- `category` — select from existing categories (required to group products).
- `images` / `imageUrl` — array or primary image URL. Use CDN-hosted URLs for performance.
- `description` — HTML or plain text description (depends on app).
- `stock` — numeric quantity available. Example: `12`.
- `inStock` — boolean; true if available for sale.
  - Behavior: checkout and server webhook decrement `stock`. When `stock <= 0`, `inStock` should be false.
- `featured` / `isNew` (if present) — toggles for homepage cards.

Duplicate prevention

- Client-side prevents duplicates by `slug` or name. Avoid creating two products with same slug.

How to add a product

1. Fill `name` (slug auto-fills).
2. Choose `category`.
3. Set `price`, `mrp` and inventory (`stock`).
4. Add image URLs.
5. Click Save. Inline validation will show errors under fields (if any).

Examples

- New product:
  - `name`: `Floral Gold Ring`
  - `slug`: `floral-gold-ring`
  - `category`: `Rings`
  - `price`: `7999`
  - `stock`: `20`
  - `inStock`: checked

Stock & orders

- Client checkout calls Razorpay; server webhook processes payment success and runs atomic transactions to decrement stock.
- If manual order or manual stock change is needed, update `stock` and `inStock` accordingly.

---

## Orders Admin (`/admin/orders`)
Purpose: view orders, update status, and search/filter.

Features

- List of orders with search and status filters.
- Click an order to view items, fees, and customer info.
- `updateStatus` allows marking `shipped`, `delivered`, `cancelled`, etc.
  - When shipping or cancelling, admin can trigger WhatsApp notifications per existing logic.
- Search by order id, customer name, or phone.

Notes

- Marking an order `cancelled` does not automatically restock items (current behavior). If you need restocking, either run the server webhook with compensating action or edit product `stock` manually.

---

## Gallery / Homepage / Testimonials Admins
- `GalleryAdmin.jsx` — add image URLs and captions used on gallery pages.
- `HomepageAdmin.jsx` — manage homepage sections, featured products order, banners on homepage.
- `TestimonialsAdmin.jsx` — add customer testimonials (name, text, photo).

Usage

- Provide image URLs and captions. Save; changes appear on the front page immediately via realtime DB.

---

## Seed / Import tools
- If there is a Seed Sync admin tool: you can import JSON seed (categories, products) from the `seed/` directory.
- Use carefully — it may overwrite existing entries. Always backup `siteSettings` and product data if possible.

---

## Payments & Webhook notes (server)
- Payments use Razorpay on client; server endpoint (`/webhook/payment-success`) verifies and marks orders as paid and adjusts product `stock`.
- Requirements:
  - Server requires Firebase admin credentials (service account) and DB URL in environment variables.
  - Add webhook signature verification (recommended) before trusting external calls.

Testing

- Use a staging webhook or call server endpoint with a sample payload and idempotency key to test stock decrements.

---

## Tips, Validation & Rollback
- Validation:
  - Inline field validation shows errors under inputs in admin screens.
  - Numeric fields coerce on Save; empty → 0.
- Images:
  - Use fast CDN-hosted URLs (Cloudinary, S3). Recommended sizes vary by page (cards vs hero).
- Banner hex vs Tailwind:
  - Hex (e.g., `#df2121`) → applied as inline background.
  - Tailwind class (e.g., `bg-orange-500`) → applied as class; ensures consistent color system.
- Reverting mistakes:
  - If you mis-save `siteSettings`, manually edit fields to previous values or restore from backup/seed.
  - For product data mistakes, correct the product entry or re-import from backup.
- Preventing oversell:
  - Rely on server webhook transactions to decrement stock. Avoid editing stock only on client.

---

## Example Admin Workflows

1. Start a short sale banner

- Go to Site Settings.
- Add lines in `bannerOffers`:
  - `Flash sale: 25% off today`
  - `Free delivery on ₹2,000+`
- Set `bannerLink` to sale landing page.
- Set `bannerBgColor` to `#df2121`.
- Check `Show top banner` and Save.

2. Add new product to category

- Create category `Earrings` if not present.
- Go to ProductsAdmin → New Product:
  - `name`: `Pearl Stud Earrings`
  - `category`: `Earrings`
  - `price`: `1299`, `stock`: `30`, `inStock`: checked
  - `imageUrl`: upload to CDN and paste URL
- Save.

3. Apply free delivery threshold

- In Site Settings:
  - `deliveryFee`: `50`
  - `freeDeliveryMin`: `2000`
  - Save. Orders with subtotal ≥ 2000 will set delivery = 0.

---

If you want a printable PDF or HTML, or screenshots added to this document, say which pages and I will add them.
