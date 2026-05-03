# E-Commerce Marketplace Design for Product-Subgraph Service

**Document Version:** 1.0  
**Date:** April 28, 2026  
**Target:** Learning project combining NestJS + MongoDB + Next.js + Microservices  
**Scope:** User roles, Seller management, Product catalog, Search & discovery (no orders/payments yet)

---

## I. Marketplace Platform Overview

### 1.1 What is an E-Commerce Marketplace?

An e-commerce marketplace is a **multi-vendor platform** where:
- **Sellers** (merchants, shop owners) upload and manage their own products
- **Buyers** (customers) browse, search, and discover products from multiple sellers
- **Admin** moderates, approves products, manages platform policies
- **Platform** (us) provides infrastructure, handles payments, logistics, dispute resolution

Common examples:
- 🛍️ **Amazon** (sellers can list products on Amazon)
- 🛍️ **Lazada / Shopee** (southeast Asian e-commerce)
- 🛍️ **eBay** (auction + buy-it-now marketplace)
- 🛍️ **Etsy** (handmade & vintage goods)

### 1.2 Key Differences from Single-Vendor E-Commerce

| Aspect | Single-Vendor Store | Marketplace |
|--------|-------------------|-----------|
| **Product ownership** | Company owns all products | Sellers own their products |
| **Shop identity** | One brand | Multiple shops per platform |
| **Seller on-boarding** | N/A | Requires verification, KYC |
| **Inventory management** | Centralized | Distributed per seller |
| **Product pricing** | Company decides | Seller decides (with platform rules) |
| **Ratings & Reviews** | For products only | For products + sellers + transactions |
| **Dispute resolution** | Company with customer | Mediator between buyer/seller |

---

## II. User Roles & Permission Model

### 2.1 User Role Hierarchy

We will extend the current `user-service` schema to support **3 core roles**:

```
┌─────────────────┐
│     User        │  (base: email, password, profile)
└────────┬────────┴─────────────────────────────────────────┐
         │                                                  │
    ┌────v─────┐      ┌─────────┐       ┌──────────┐
    │  BUYER   │      │ SELLER  │       │  ADMIN   │
    └──────────┘      └────┬────┘       └──────────┘
                           │
                      ┌────v──────────┐
                      │ SellerProfile │ (shop info + status)
                      └───────────────┘
```

### 2.2 Role Definitions

#### **Role: BUYER**
- **Description:** Regular customer who browses and purchases products
- **Requirements:** Verified email (optional for MVP)
- **Capabilities:**
  - ✅ Browse & search products
  - ✅ View product details, images, reviews, seller info
  - ✅ Add products to cart
  - ✅ Create orders (future phase)
  - ✅ Leave reviews & ratings (post-purchase, future phase)
  - ✅ Message sellers (future phase)
- **Permissions:** Read-heavy, basic write (cart, reviews)
- **Data Access:** Can only see their own orders, reviews, wishlist

**Prisma Model Extension:**
```prisma
model User {
  // ... existing fields ...
  role          Role          @default(BUYER)
  // BUYER | SELLER | ADMIN
  
  // Buyer-specific (optional, can expand)
  shippingAddresses    ShippingAddress[]
  wishlist             Wishlist[]
  reviews              Review[]      // product reviews left by this user
  
  // Seller-specific
  sellerProfile        SellerProfile?  // if role == SELLER
}

enum Role {
  BUYER
  SELLER
  ADMIN
}
```

#### **Role: SELLER**
- **Description:** Merchant who uploads, manages, and sells products on the platform
- **Requirements:**
  - ✅ Valid email + verified
  - ✅ Complete seller profile (shop name, description, etc.)
  - ✅ Accepted seller terms & conditions
  - ✅ ID verification (KYC) for higher-tier features (future)
- **Capabilities:**
  - ✅ Create & edit own products
  - ✅ Upload product images
  - ✅ Set product prices & inventory
  - ✅ View own shop analytics (basic: product views, orders)
  - ✅ Respond to buyer messages
  - ✅ Monitor product reviews
  - ✅ Cannot edit/delete other sellers' products
- **Permissions:** Write to own products only
- **Data Access:** Can only see products & orders for their own shop

**Prisma Model Extension:**
```prisma
model SellerProfile {
  id               String    @id @default(uuid())
  userId           String    @unique
  
  // Shop identity
  shopName         String    @unique
  shopDescription  String?
  shopThumbnail    String?   // image key/URL to seller avatar
  phoneNumber      String?
  
  // Status & verification
  status           SellerStatus @default(PENDING_VERIFICATION)
  // PENDING_VERIFICATION | VERIFIED | SUSPENDED | BANNED
  
  isKycVerified    Boolean   @default(false)
  
  // Seller stats (denormalized for performance)
  totalProducts    Int       @default(0)
  totalOrders      Int       @default(0)
  averageRating    Float?
  responseTimeHours Float?
  
  // Banking info (for payouts, future phase)
  bankAccountName  String?
  bankAccountNumber String?
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  products         Product[]
  
  @@index([status])
  @@map("seller_profiles")
}

enum SellerStatus {
  PENDING_VERIFICATION
  VERIFIED
  SUSPENDED
  BANNED
}
```

#### **Role: ADMIN**
- **Description:** Platform administrator with governance & moderation power
- **Requirements:** Manual assignment by super-admin
- **Capabilities:**
  - ✅ Approve/reject seller applications
  - ✅ Suspend/ban sellers & products
  - ✅ View all products across all sellers
  - ✅ Monitor reviews & flag inappropriate content
  - ✅ Generate analytics reports
  - ✅ Manage platform policies (commission rates, category rules, etc.)
- **Permissions:** Full read + selective write (moderation actions)
- **Data Access:** Can see all data (unrestricted)

---

## III. Seller Workflow & Onboarding

### 3.1 Seller Registration & Onboarding Flow

```
Step 1: User registers as BUYER (default role)
  ↓
Step 2: User opts to become SELLER
  ↓
Step 3: User fills SellerProfile form
  - Shop name (unique)
  - Shop description
  - Phone number
  - Agree to seller terms
  ↓
Step 4: System creates SellerProfile with status = PENDING_VERIFICATION
  ↓
Step 5: Admin reviews seller profile
  - (Future: KYC verification, bank info validation)
  ↓
Step 6: Admin approves → status = VERIFIED
  OR rejects → sends notification to seller
  ↓
Step 7: Verified seller can upload products
```

### 3.2 Seller Statuses & Actions

| Status | Can Upload Products? | Can View Orders? | Can Receive Payments? |
|--------|:-------------------:|:----------------:|:-------------------:|
| `PENDING_VERIFICATION` | ❌ No | ❌ No | ❌ No |
| `VERIFIED` | ✅ Yes | ✅ Yes | ✅ Yes |
| `SUSPENDED` | ❌ No | ⚠️ Limited | ⚠️ Frozen |
| `BANNED` | ❌ No | ❌ No | ❌ No |

**Suspension scenarios:**
- Low product quality (negative reviews)
- Violation of product policies (fake items, banned categories)
- Poor customer service (slow response, refund fraud)
- Admin decision (temporary)

---

## IV. Product Model & Catalog Management

### 4.1 Core Product Schema

The product needs to support **multiple sellers**, **rich metadata**, and **platform policies**.

```prisma
model Product {
  id               String    @id @default(uuid())
  
  // Seller ownership
  sellerId         String    // FK to SellerProfile.userId
  seller           SellerProfile @relation(fields: [sellerId], references: [userId])
  
  // Basic info
  title            String    @db.VarChar(200)
  description      String    @db.Text
  
  // Categorization
  categoryId       String?   // FK to Category (future: add Category model)
  category         Category? @relation(fields: [categoryId], references: [id])
  
  // Pricing & inventory
  price            Float     @db.Decimal(10, 2)  // main selling price
  cost             Float?    @db.Decimal(10, 2)  // seller's cost (optional, for analytics)
  
  stock            Int       @default(0)
  reserved         Int       @default(0)         // reserved in carts/pending orders
  
  // Images & media
  images           ProductImage[]
  
  // Product attributes (flexible key-value)
  attributes       Json?     // e.g., { "color": "red", "size": "M", "material": "cotton" }
  
  // SEO & search
  slug             String    @unique              // URL-friendly: "iphone-15-pro"
  tags             String[]  @default([])         // for search: ["phone", "iphone", "apple"]
  
  // Product status & visibility
  status           ProductStatus @default(DRAFT)
  // DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | DELISTED
  
  isActive         Boolean   @default(true)       // soft delete
  
  // Timestamps
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  // Relations
  reviews          Review[]
  cartItems        CartItem[]
  orderItems       OrderItem[]  // order snapshot (future phase)
  
  @@index([sellerId])
  @@index([categoryId])
  @@index([status])
  @@index([createdAt])
  @@fulltext([title, description, tags])  // for full-text search
  @@map("products")
}

enum ProductStatus {
  DRAFT               // seller still editing
  PENDING_APPROVAL    // waiting for admin review
  APPROVED            // approved, visible to buyers
  REJECTED            // admin rejected (reason in rejection log)
  DELISTED            // removed from sale (by admin or seller)
}

model ProductImage {
  id               String    @id @default(uuid())
  productId        String
  
  // Image storage (MinIO/S3)
  // - URL format: /api/products/{productId}/images/{imageName}
  // - Object key in MinIO: products/{sellerId}/{productId}/{uuid}.jpg
  
  imageUrl         String    // public URL or presigned URL
  thumbnailUrl     String?   // for listing pages (resized version)
  
  displayOrder     Int       @default(0)
  
  uploadedAt       DateTime  @default(now())
  
  product          Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@index([productId])
  @@map("product_images")
}

model Category {
  id               String    @id @default(uuid())
  name             String    @unique
  description      String?
  
  products         Product[]
  
  @@map("categories")
}
```

### 4.2 Product Lifecycle & Status Flow

```
SELLER UPLOADS PRODUCT
      ↓
   DRAFT (seller can edit)
      ↓ (seller clicks "submit for approval")
PENDING_APPROVAL (awaiting admin review)
      ↓
   ┌──┴──────────────────┐
   │                     │
   ↓ (admin approved)    ↓ (admin rejected)
APPROVED            REJECTED
   │                     │
   ├─→ (visible in search, buyers can see)
   │                     └─→ (seller notified, can resubmit)
   │
   ↓ (seller or admin delists)
DELISTED (removed from sale, but data preserved)
```

### 4.3 Product Attributes (Flexible Schema)

For product variants & filtering (e.g., clothing sizes, phone colors):

```json
{
  "attributes": {
    "brand": "Apple",
    "colour": ["Red", "Blue"],
    "size": ["S", "M", "L"],
    "material": "Stainless Steel",
    "warranty": "1 Year"
  }
}
```

Later on, after MVP stable, we can support:
- **Product Variants** (e.g., iPhone 15 Pro in different colors = different SKUs)
- **Variable Pricing** (e.g., M size more expensive than S)
- **Variant-specific Stock** (e.g., Red large = 5 units, Blue medium = 3 units)

---

## V. Product Service Responsibilities (MongoDB)

### 5.1 CRUD Operations by Role

#### **SELLER: Upload Product**
```
POST /products
{
  "title": "iPhone 15 Pro",
  "description": "Latest Apple flagship",
  "categoryId": "...",
  "price": 999,
  "cost": 700,
  "stock": 50,
  "attributes": { "brand": "Apple", "color": "Gold" },
  "tags": ["iphone", "apple", "premium"]
}

Response:
{
  "id": "product-123",
  "sellerId": "user-101",  // auto from JWT
  "status": "DRAFT",
  "createdAt": "2026-04-28T..."
}
```

**Permission:** SELLER OR ADMIN (for testing)

#### **SELLER: Edit Product (Draft only)**
```
PUT /products/{id}
{
  "title": "iPhone 15 Pro (Updated)",
  "price": 949,
  "stock": 40
}
```

**Permission:** Product seller only (check authorz: JWT userId == product.sellerId)

#### **SELLER: Submit Product for Approval**
```
PATCH /products/{id}/submit-approval
```

**Effect:**
- Change status: DRAFT → PENDING_APPROVAL
- Trigger event: `product.submitted_for_approval.v1`

**Permission:** Product seller only

#### **SELLER: Upload Product Images**
```
POST /products/{id}/images
(multipart form-data)
- file: [image1.jpg, image2.jpg, ...]

Response:
[
  { "id": "img-1", "imageUrl": "..." },
  { "id": "img-2", "imageUrl": "..." }
]
```

**Storage:**
- Upload to MinIO/S3: `products/{sellerId}/{productId}/{uuid}.jpg`
- Metadata (path, order) stored in MongoDB ProductImage

**Permission:** Product seller only

#### **ADMIN: Approve/Reject Product**
```
PATCH /products/{id}/approve
{
  "decision": "APPROVED"  // or "REJECTED"
  "reason": "Quality images, accurate description"
}
```

**Effect:**
- Change status: PENDING_APPROVAL → APPROVED (or REJECTED)
- Trigger event: `product.approved.v1` or `product.rejected.v1`
- Send notification to seller

**Permission:** ADMIN only

---

### 5.2 Search & Discovery (BUYER perspective)

#### **BUYER: Search Products**
```
GET /products?q=iphone&category=electronics&minPrice=500&maxPrice=1500&sort=price_asc

Response:
{
  "total": 234,
  "page": 1,
  "limit": 20,
  "products": [
    {
      "id": "...",
      "title": "iPhone 15 Pro",
      "price": 999,
      "images": [{ "imageUrl": "...", "thumbnailUrl": "..." }],
      "seller": {
        "userId": "...",
        "shopName": "Apple Official Store",
        "averageRating": 4.8
      },
      "status": "APPROVED"
    },
    // ...
  ]
}
```

**Features to implement:**
- ✅ Full-text search: title + description + tags
- ✅ Filter by price range, category, rating
- ✅ Sort: by relevance (default), by price, by newest, by popularity
- ✅ Pagination: limit + offset
- ✅ Only show APPROVED products to buyers

**Query Optimization:**
- Index on: `status`, `title`, `tags`, `categoryId`, `price`, `createdAt`
- Full-text index on: `title`, `description`, `tags`
- Cache popular searches in Redis (TTL: 1 hour)

#### **BUYER: View Product Detail**
```
GET /products/{slug}

Response:
{
  "id": "...",
  "title": "iPhone 15 Pro",
  "description": "...",
  "price": 999,
  "stock": 50,
  "images": [...],
  "reviews": [...],
  "seller": {
    "shopName": "Apple Official Store",
    "totalProducts": 500,
    "averageRating": 4.8,
    "responseTime": "< 2 hours"
  },
  "attributes": { "brand": "Apple", "color": "Gold" }
}
```

---

### 5.3 PRODUCT Service Validation Rules

#### **On Product Creation**

```typescript
if (seller.status !== 'VERIFIED') {
  throw new Error("Only verified sellers can upload products");
}

if (input.price < 0 || input.stock < 0) {
  throw new Error("Price and stock must be non-negative");
}

if (input.title.length < 10 || input.title.length > 200) {
  throw new Error("Title must be 10-200 characters");
}

if (!input.categoryId || !categoryExists(input.categoryId)) {
  throw new Error("Invalid category");
}

if (input.images && input.images.length > 10) {
  throw new Error("Max 10 images per product");
}
```

#### **On Product Search (Visibility)**

```typescript
// Buyers can only see:
// - status = APPROVED
// - isActive = true
// - seller.status = VERIFIED

// Sellers can see:
// - Own products (any status)

// Admins can see:
// - All products (any status)
```

---

## VI. Permission Matrix

### 6.1 Product Operations

| Operation | BUYER | SELLER (Own) | SELLER (Others) | ADMIN |
|-----------|:-----:|:------------:|:----------------:|:-----:|
| View search (APPROVED only) | ✅ | ✅ | ✅ | ✅ |
| View own products (any status) | - | ✅ | - | - |
| Create product | ❌ | ✅ | ❌ | ✅ |
| Edit product | ❌ | ✅ | ❌ | ⚠️ |
| Delete product | ❌ | ✅ (DRAFT) | ❌ | ✅ |
| Upload images | ❌ | ✅ | ❌ | ⚠️ |
| Submit for approval | ❌ | ✅ | ❌ | - |
| Approve/Reject | ❌ | ❌ | ❌ | ✅ |
| Suspend/Ban | ❌ | ❌ | ❌ | ✅ |

**Legend:**
- ✅ = Full permission
- ❌ = No permission
- ⚠️ = Limited (e.g., admin can view but not edit pricing)

### 6.2 API Endpoint Security Pattern

```typescript
// Example: PUT /products/{id}
async updateProduct(req, res) {
  const { id } = req.params;
  const { userId, role } = req.user;  // from JWT token
  
  const product = await productService.findById(id);
  
  // Authorization check
  if (role === 'ADMIN') {
    // Admin can edit anything
  } else if (role === 'SELLER' && userId === product.sellerId) {
    // Seller can only edit own product
    if (product.status !== 'DRAFT') {
      throw new PermissionError("Can only edit draft products");
    }
  } else {
    throw new ForbiddenError("You don't have permission");
  }
  
  // Update logic
  const updated = await productService.update(id, req.body);
  res.json(updated);
}
```

---

## VII. Features & Roadmap

### Phase 1: MVP (Current - Weeks 1-2) ✅

**Must-have:**
- [ ] Extend User model: add `role` field (BUYER, SELLER, ADMIN)
- [ ] Create SellerProfile model
- [ ] Product CRUD: create, read (BUYER search), update (SELLER), delete (SELLER draft only)
- [ ] Product images upload (to MinIO)
- [ ] Product status workflow: DRAFT → PENDING_APPROVAL → APPROVED
- [ ] Admin approve/reject product
- [ ] Search products (full-text): title, description, tags, category
- [ ] Filter & sort: price, newest, relevance
- [ ] Pagination

**Tests:**
- Unit tests: service logic (validation, status transitions)
- E2E tests: happy path (seller uploads → admin approves → buyer finds)
- 30+ test cases total

### Phase 1.1: Seller Onboarding (Week 3)

- [ ] User → SELLER role conversion
- [ ] SellerProfile creation & verification
- [ ] Seller KYC form (optional UI in Next.js)
- [ ] Admin dashboard to verify sellers
- [ ] Notification system (email to seller when approved)

### Phase 2: Enhanced Features (Weeks 4-6)

- [ ] Product variants (color, size)
- [ ] Variant-specific pricing & stock
- [ ] Product reviews & ratings (by buyers post-purchase)
- [ ] Seller ratings (aggregated from orders)
- [ ] Advanced search: filters by seller, rating, attributes
- [ ] Product recommendations (based on search history)
- [ ] Wishlist (BUYER saves favorite products)
- [ ] Seller dashboard: analytics (views, clicks, conversions)

### Phase 3: Moderation & Content (Week 7-8)

- [ ] Admin moderation tools: flag/review/remove products
- [ ] Category management with prohibited items
- [ ] Anti-counterfeit policy enforcement
- [ ] Seller suspension/ban workflow
- [ ] Audit log for moderation actions

### Phase 4: Marketplace Utilities (Week 9+)

- [ ] Seller bulk upload (CSV import)
- [ ] Product QR codes for offline-to-online
- [ ] Trending products / home page featured
- [ ] Seller subscription tiers (basic free, premium with fees)
- [ ] Commission model: platform takes % of each sale
- [ ] Payout system (when integrated with payment service)

---

## VIII. Data Models in MongoDB

### 8.1 Mongoose Schemas (NestJS product-subgraph)

```typescript
// product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ versionKey: false, timestamps: true })
export class Product {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  sellerId!: string;  // FK to User.id from user-service

  @Prop()
  categoryId?: string;

  @Prop({ required: true, type: Number })
  price!: number;

  @Prop({ type: Number })
  cost?: number;

  @Prop({ required: true, default: 0 })
  stock!: number;

  @Prop({ default: 0 })
  reserved?: number;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({
    required: true,
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DELISTED'],
    default: 'DRAFT',
  })
  status!: string;

  @Prop({ default: true })
  isActive?: boolean;

  @Prop({ type: Object })
  attributes?: Record<string, any>;

  @Prop({ type: [Object] })  // Array of { imageUrl, thumbnailUrl, displayOrder }
  images?: Array<{
    id: string;
    imageUrl: string;
    thumbnailUrl?: string;
    displayOrder: number;
  }>;

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt?: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes for performance
ProductSchema.index({ sellerId: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });  // Full-text
ProductSchema.index({ price: 1 });
ProductSchema.index({ slug: 1 });
```

### 8.2 Extending User Service (Prisma)

```prisma
// user-service/prisma/schema.prisma

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  avatarUrl    String?

  // NEW: Role management
  role         Role     @default(BUYER)
  
  bio         String?
  dateOfBirth DateTime?
  phoneNumber String?  @unique
  gender      Gender?

  twoFactorEnabled Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  refreshTokens       RefreshToken[]
  authSessions        AuthSession[]
  passwordResetTokens PasswordResetToken[]
  emailOtps           EmailOtp[]
  
  // NEW: Seller profile (if role == SELLER)
  sellerProfile       SellerProfile?
  
  auditLogsAsActor    AuditLog[] @relation("AuditLogActor")
  auditLogsAsTarget   AuditLog[] @relation("AuditLogTarget")

  @@map("users")
}

enum Role {
  BUYER
  SELLER
  ADMIN
}

model SellerProfile {
  id               String    @id @default(uuid())
  userId           String    @unique
  
  shopName         String    @unique
  shopDescription  String?
  shopThumbnail    String?
  phoneNumber      String?
  
  status           SellerStatus @default(PENDING_VERIFICATION)
  isKycVerified    Boolean   @default(false)
  
  totalProducts    Int       @default(0)
  totalOrders      Int       @default(0)
  averageRating    Float?
  responseTimeHours Float?
  
  bankAccountName  String?
  bankAccountNumber String?
  
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([status])
  @@map("seller_profiles")
}

enum SellerStatus {
  PENDING_VERIFICATION
  VERIFIED
  SUSPENDED
  BANNED
}
```

---

## IX. API Contract Examples (REST for MVP, GraphQL later)

### 9.1 Seller Endpoints

#### 1. Get Seller Profile
```http
GET /api/sellers/{userId}
Authorization: Bearer {accessToken}

Response (200):
{
  "id": "seller-1",
  "userId": "user-1",
  "shopName": "Apple Official Store",
  "shopDescription": "Authorized Apple reseller",
  "status": "VERIFIED",
  "averageRating": 4.8,
  "totalProducts": 150,
  "totalOrders": 1200
}
```

#### 2. Update Seller Profile
```http
PUT /api/sellers/me
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "shopDescription": "Premium electronics store",
  "phoneNumber": "+84-0-123-456-789"
}

Response (200): updated seller profile
```

### 9.2 Product Endpoints

#### 1. Create Product (SELLER)
```http
POST /api/products
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "iPhone 15 Pro 256GB",
  "description": "Latest iPhone with A18 chip",
  "categoryId": "electronics",
  "price": 999.99,
  "cost": 700,
  "stock": 50,
  "attributes": {
    "brand": "Apple",
    "color": "Gold",
    "storage": "256GB"
  },
  "tags": ["iphone", "apple", "smartphone"]
}

Response (201):
{
  "id": "prod-123",
  "sellerId": "user-1",
  "status": "DRAFT",
  "createdAt": "2026-04-28T10:00:00Z"
}
```

#### 2. Search Products (PUBLIC, All users)
```http
GET /api/products?q=iphone&categoryId=electronics&minPrice=800&maxPrice=1200&limit=20&page=1&sort=price_asc

Response (200):
{
  "total": 45,
  "page": 1,
  "limit": 20,
  "products": [
    {
      "id": "prod-123",
      "title": "iPhone 15 Pro 256GB",
      "price": 999.99,
      "slug": "iphone-15-pro-256gb",
      "thumbnail": "https://images.example.com/prod-123-thumb.jpg",
      "seller": {
        "shopName": "Apple Official Store",
        "averageRating": 4.8,
        "totalReviews": 320
      },
      "status": "APPROVED"
    }
  ]
}
```

#### 3. Get Product Detail
```http
GET /api/products/{slug}

Response (200):
{
  "id": "prod-123",
  "title": "iPhone 15 Pro 256GB",
  "description": "...",
  "price": 999.99,
  "stock": 50,
  "images": [
    {
      "imageUrl": "https://cdn.example.com/prod-123-1.jpg",
      "thumbnailUrl": "..."
    }
  ],
  "seller": {
    "userId": "user-1",
    "shopName": "Apple Official Store",
    "averageRating": 4.8,
    "totalReviews": 320,
    "responseTime": "< 2 hours"
  },
  "attributes": {
    "brand": "Apple",
    "color": "Gold"
  },
  "reviews": [
    {
      "rating": 5,
      "text": "Excellent product!",
      "reviewer": "John Doe"
    }
  ]
}
```

#### 4. Update Product (SELLER, only DRAFT)
```http
PUT /api/products/{id}
Authorization: Bearer {accessToken}

{
  "title": "iPhone 15 Pro 512GB",
  "price": 1099.99,
  "stock": 30
}

Response (200): updated product (still in DRAFT)
```

#### 5. Submit for Approval (SELLER)
```http
PATCH /api/products/{id}/submit-approval
Authorization: Bearer {accessToken}

Response (200):
{
  "id": "prod-123",
  "status": "PENDING_APPROVAL",
  "message": "Your product is now pending admin review"
}
```

#### 6. Approve Product (ADMIN)
```http
PATCH /api/products/{id}/approve
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "decision": "APPROVED",
  "reason": "Clear images, accurate details"
}

Response (200):
{
  "id": "prod-123",
  "status": "APPROVED"
}

// Event published: product.approved.v1
// Email sent to seller: "Your product has been approved!"
```

#### 7. Reject Product (ADMIN)
```http
PATCH /api/products/{id}/approve
Authorization: Bearer {accessToken}

{
  "decision": "REJECTED",
  "reason": "Images are blurry. Please re-upload with high quality."
}

Response (200):
{
  "id": "prod-123",
  "status": "REJECTED"
}

// Email sent: "Your product was rejected. Reason: ..."
```

#### 8. Upload Product Images (SELLER)
```http
POST /api/products/{id}/images
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

(multipart)
file: [image1.jpg, image2.jpg, ...]

Response (201):
{
  "images": [
    { "id": "img-1", "imageUrl": "https://cdn.example.com/prod-123-1.jpg" },
    { "id": "img-2", "imageUrl": "https://cdn.example.com/prod-123-2.jpg" }
  ]
}
```

#### 9. Delete Product (SELLER, only DRAFT)
```http
DELETE /api/products/{id}
Authorization: Bearer {accessToken}

Response (204): No Content
```

---

## X. Integration with Other Services

### 10.1 Event Publishing (RabbitMQ)

Product service publishes these events:

```
product.created.v1
{
  "productId": "prod-123",
  "sellerId": "user-1",
  "title": "...",
  "price": 999.99,
  "timestamp": "2026-04-28T10:00:00Z"
}

product.updated.v1
{
  "productId": "prod-123",
  "changes": { "price": { "from": 999, "to": 949 } },
  "timestamp": "..."
}

product.approved.v1
{
  "productId": "prod-123",
  "sellerId": "user-1",
  "timestamp": "..."
}

product.rejected.v1
{
  "productId": "prod-123",
  "sellerId": "user-1",
  "reason": "Images are blurry",
  "timestamp": "..."
}

product.deleted.v1
{
  "productId": "prod-123",
  "sellerId": "user-1",
  "timestamp": "..."
}
```

### 10.2 Dependencies on Other Services

**From user-service:**
- GET `/api/users/{userId}` → fetch seller profile during product creation (validation)
- GET `/api/users/sellers/{userId}` → fetch seller details for product listing

**From notification-worker (future):**
- Subscribe to `product.approved.v1` → send email to seller
- Subscribe to `product.rejected.v1` → send email with rejection reason

**From graphql-gateway (federated):**
- Link Product federation key: `@key(fields: "id")`
- Allow order-service to reference Product by ID

---

## XI. Search & Discovery Strategy

### 11.1 MongoDB Full-Text Search

```javascript
// Create text index in MongoDB
db.products.createIndex({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Query (Mongoose example)
Product.find({
  $text: { $search: 'iphone pro' },
  status: 'APPROVED',
  isActive: true
})
  .limit(20)
  .skip((page - 1) * 20)
  .sort({ score: { $meta: 'textScore' } })
```

### 11.2 Query Filters

```javascript
// Composite query example
const filters = {
  $and: [
    { status: 'APPROVED' },
    { isActive: true },
    { price: { $gte: minPrice, $lte: maxPrice } },
    { categoryId: categoryId },
    seller.status: 'VERIFIED'
  ]
};

Product.find(filters)
  .sort({ [sort]: sortOrder })  // sort by price, newest, relevance
  .limit(limit)
  .skip(offset);
```

### 11.3 Performance Optimization

```typescript
// Index strategy
[
  { sellerId: 1 },                                    // find by seller
  { status: 1 },                                       // filter approved only
  { categoryId: 1 },                                   // filter by category
  { price: 1 },                                        // sort/filter by price
  { createdAt: -1 },                                   // sort by newest
  { title: 'text', description: 'text', tags: 'text' } // full-text search
]

// Cache strategy
- Cache popular search results in Redis: key = "search:<q>:<filters>", TTL = 1 hour
- Cache product detail: key = "product:<id>", TTL = 24 hours
- Invalidate cache on product update/delete event
```

---

## XII. Security Considerations

### 12.1 Authorization Rules

```typescript
// BUYER: can only see APPROVED products
// SELLER: can see own products (any status) + APPROVED products from others
// ADMIN: can see all products

// SELLER: can only edit/delete own products in DRAFT status
// ADMIN: can edit/delete any product and change status
```

### 12.2 Input Validation

```typescript
// Title: 10-200 chars, no HTML/injection
// Description: max 5000 chars
// Price: 0.01 - 1,000,000 (decimal, 2 places)
// Stock: 0 - 9,999,999 (integer)
// Images: jpg/png, < 5MB each, max 10 images

// Validate on both DTOs and Mongoose schema
```

### 12.3 File Upload Security

```
- Validate file type: only jpg, png, webp
- Resize images on server (prevent abuse)
- Store in separate bucket: products/{sellerId}/{productId}/
- Generate presigned URLs (time-limited access)
- Scan for malware/NSFW content (future)
```

---

## XIII. Monitoring & Analytics

### 13.1 Key Metrics to Track

- **Catalog Health:**
  - Total products / by status
  - Products per seller (avg, min, max)
  - Avg time to approval

- **Seller Performance:**
  - Verified sellers count
  - Seller suspension rate
  - Avg products per verified seller

- **Search & Discovery:**
  - Top search queries
  - Products found in search
  - Click-through rate by product

- **Product Quality:**
  - Avg review rating
  - % of products with reviews
  - % of rejected products

---

## XIV. Glossary

| Term | Definition |
|------|-----------|
| **SKU** | Stock Keeping Unit (usually variant ID) |
| **Slug** | URL-friendly identifier (e.g., "iphone-15-pro") |
| **Attributes** | Product properties (color, size, brand) |
| **DRAFT** | Product under creation, not published |
| **APPROVED** | Product published, visible to buyers |
| **DELISTED** | Removed from sale (data still exists) |
| **Seller Rating** | Avg rating from customer feedback on seller |
| **Product Rating** | Avg rating from customer reviews on product |
| **KYC** | Know Your Customer (identity verification) |
| **Presigned URL** | Time-limited access URL for files in cloud storage |

---

## XV. Next Steps for Implementation

### Immediate (Phase 1 MVP - Week 1-2)

1. ✅ **Extend User Schema** (user-service)
   - Add `role` field
   - Create `SellerProfile` model
   - Add migration

2. ✅ **Update Product Schema** (product-subgraph)
   - Add `sellerId`, `categoryId`, `attributes`, `slug`, `tags`, `images`, `status`
   - Add MongoDB full-text indexes

3. ✅ **Implement CRUD**
   - Create product (seller)
   - View product (buyer search)
   - Update product (seller, draft only)
   - Submit for approval (seller)
   - Approve/reject (admin)

4. ✅ **Add Search & Filter**
   - Full-text search
   - Filter by price, category, rating
   - Sort by price/newest/relevance
   - Pagination

5. ✅ **Comprehensive Tests**
   - Unit: service logic, validation
   - E2E: seller workflow, buyer search, admin approval
   - 40+ test cases

### Week 3-4 (Phase 1.1)

- Seller profile management
- Seller onboarding/KYC flow
- Image upload to MinIO
- Admin seller verification dashboard

### Week 5+ (Phase 2+)

- Product variants
- Reviews & ratings
- Advanced analytics
- GraphQL integration

---

**Document Status:** Ready for implementation  
**Last Updated:** April 28, 2026  
**Owner:** Learning Project Team
