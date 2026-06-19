# Advanced Marketplace Design: RBAC, Workflows & Patterns

**Document Version:** 2.0 (Deep Dive)  
**Date:** April 28, 2026  
**Reference:** Amazon, Lazada, Shopee architecture patterns  
**Scope:** Permission system, workflows, design patterns for scalability

---

## I. Why Simple Role Enum is NOT Enough

### 1.1 The Problem with Enum Role

Your current design:
```typescript
enum Role {
  BUYER
  SELLER
  ADMIN
}
```

**Issues:**
1. **Too coarse-grained:** A single ADMIN can't have granular permissions
   - Some admins only moderate products
   - Some admins manage sellers
   - Some admins manage categories
   - Some admins view analytics

2. **No seller tiers:** Lazada/Shopee have:
   - Individual sellers (自销售)
   - Store sellers (shop owner)
   - Brand partners (官方品牌)
   - Premium sellers (VIP tier)
   - Each with different commission rates, features, limits

3. **Missing status variations:**
   - BUYER can be: active, suspended, banned
   - SELLER can be: pending, verified, premium, suspended, banned
   - ADMIN can be: moderator, analyst, manager, super-admin

4. **No permission delegation:** Can't grant specific capabilities (e.g., "user A can upload images but not pricing")

5. **Inflexible for features:**
   - Can't create "temporary seller" role during promotions
   - Can't have "affiliate seller" role (dropshipping)
   - Can't have "warehouse manager" role (inventory management)

### 1.2 How Real Platforms Handle This

**Amazon:**
```
- Customer
- Seller (individual or professional)
- Vendor (brand selling their own products)
- Associates (affiliates)
- Support staff
- Operations team
- Analytics team
```

**Lazada/Shopee (Southeast Asia):**
```
- Buyer
- Seller (自销售 Individual)
- Merchant (商家 Shop organization)
- Brand Partner (官方品牌)
- Premium Seller (高级卖家)
- Logistics Partner (物流合作)
- Admin (Moderation)
- Admin (Analytics)
- Admin (Finance)
```

---

## II. Modern RBAC + Permission Architecture

### 2.1 Proposed Role-Permission Model

Instead of simple enum, use **3-layer permission model:**

```
Layer 1: Role (WHO)
  ├─ BUYER
  ├─ SELLER
  ├─ SELLER_PREMIUM
  ├─ AFFILIATE
  ├─ LOGISTICS_PARTNER
  ├─ ADMIN_MODERATOR
  ├─ ADMIN_ANALYTICS
  ├─ ADMIN_OPERATIONS
  └─ SUPER_ADMIN

Layer 2: Permission (WHAT)
  ├─ product:create
  ├─ product:edit
  ├─ product:delete
  ├─ product:view_own
  ├─ product:view_all
  ├─ seller:approve
  ├─ seller:suspend
  ├─ order:view
  ├─ analytics:view_dashboard
  └─ [100+ more...]

Layer 3: Resource Scope (WHERE)
  ├─ own_products (my products only)
  ├─ own_shop (my shop)
  ├─ all_products (platform-wide)
  ├─ all_sellers (all sellers)
  └─ all_categories (all categories)
```

### 2.2 Prisma Schema with RBAC

```prisma
// user-service/prisma/schema.prisma

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  displayName   String

  // NEW: Flexible role system
  roles         UserRole[]  // Many-to-many: user can have multiple roles
  permissions   UserPermission[]  // Direct permissions (can override role defaults)

  // Status
  status        UserStatus @default(ACTIVE)
  // ACTIVE | SUSPENDED | BANNED | PENDING_VERIFICATION

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sellerProfile SellerProfile?
  auditLogs     AuditLog[]

  @@map("users")
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  BANNED
  PENDING_VERIFICATION
}

// Many-to-many: User ↔ Role
model UserRole {
  id        String   @id @default(uuid())
  userId    String
  roleId    String
  
  // When this role was assigned
  assignedAt DateTime @default(now())
  
  // When this role expires (null = never)
  expiresAt DateTime?
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id])

  @@unique([userId, roleId])
  @@map("user_roles")
}

// Define all roles in platform
model Role {
  id          String   @id @default(uuid())
  name        String   @unique  // "BUYER", "SELLER", "ADMIN_MODERATOR"
  displayName String            // "Buyer", "Seller", "Admin - Moderation"
  description String?
  
  // Is this role for platform users or just internal?
  isPublic    Boolean  @default(true)
  
  permissions RolePermission[]
  users       UserRole[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("roles")
}

// Many-to-many: Role ↔ Permission
model RolePermission {
  id           String   @id @default(uuid())
  roleId       String
  permissionId String
  
  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

// Direct permission override (user can have extra permissions)
model UserPermission {
  id           String   @id @default(uuid())
  userId       String
  permissionId String
  
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id])

  @@unique([userId, permissionId])
  @@map("user_permissions")
}

// Define all capabilities in platform
model Permission {
  id          String   @id @default(uuid())
  name        String   @unique
  // "product:create", "product:edit", "seller:approve", etc.
  
  description String?
  category    String   // "product", "seller", "order", "admin"
  
  roles       RolePermission[]
  users       UserPermission[]

  createdAt   DateTime @default(now())

  @@map("permissions")
}

// Seller-specific profile
model SellerProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  
  shopName      String   @unique
  shopDesc      String?
  
  // NEW: Seller tier
  sellerTier    SellerTier @default(INDIVIDUAL)
  // INDIVIDUAL | MERCHANT | BRAND_PARTNER | PREMIUM
  
  status        SellerStatus @default(PENDING_VERIFICATION)
  isKycVerified Boolean   @default(false)
  
  // Seller stats
  totalProducts Int       @default(0)
  totalOrders   Int       @default(0)
  totalReviews  Int       @default(0)
  avgRating     Float?
  
  // Commission/fees
  commissionRate Float?  // 5% = 5.0, null = use platform default
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([sellerTier])
  @@map("seller_profiles")
}

enum SellerTier {
  INDIVIDUAL        // Solo seller, basic features
  MERCHANT          // Shop organization, more features
  BRAND_PARTNER     // Official brand (higher verification)
  PREMIUM           // VIP seller with special treatment
  AFFILIATE         // Dropshipping partner
}

enum SellerStatus {
  PENDING_VERIFICATION
  VERIFIED
  SUSPENDED
  BANNED
}

// Audit log for compliance
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String   // "product:created", "seller:approved"
  resource  String   // "products", "sellers"
  resourceId String?
  
  metadata  Json?    // Details
  
  createdAt DateTime @default(now())

  @@map("audit_logs")
}
```

### 2.3 Predefined Roles (Database Seed)

```typescript
// Hard-coded roles for your platform
const PRESET_ROLES = {
  // Buyer/Customer
  BUYER: {
    name: "BUYER",
    displayName: "Buyer",
    permissions: [
      "product:view_approved",
      "product:search",
      "product:view_detail",
      "shop:view_info",
      "review:create_own",
      "review:view",
      "wishlist:manage",
      "cart:manage",
    ],
  },

  // Seller - Individual
  SELLER: {
    name: "SELLER",
    displayName: "Seller (Individual)",
    permissions: [
      "product:create",
      "product:edit_own",
      "product:delete_own_draft",
      "product:list_own",
      "product:submit_approval",
      "product:upload_images",
      "shop:edit_own",
      "order:view_own",
      "review:respond",
      "analytics:view_own",
    ],
  },

  // Seller - Premium
  SELLER_PREMIUM: {
    name: "SELLER_PREMIUM",
    displayName: "Premium Seller",
    inherits: "SELLER", // Inherit all SELLER permissions
    permissions: [
      "product:bulk_upload",
      "product:quick_restock",
      "promotion:create_own",
      "seller:hide_shop_status", // Hide shop during maintenance
      "analytics:advanced_dashboard",
      "seller:dedicated_support",
    ],
  },

  // Admin - Moderation
  ADMIN_MODERATOR: {
    name: "ADMIN_MODERATOR",
    displayName: "Admin (Moderation)",
    permissions: [
      "product:view_all",
      "product:approve_pending",
      "product:reject",
      "product:delist",
      "product:flag_for_review",
      "seller:view_all",
      "seller:suspend",
      "seller:warn",
      "review:flag_inappropriate",
      "review:delete",
    ],
  },

  // Admin - Operations
  ADMIN_OPERATIONS: {
    name: "ADMIN_OPERATIONS",
    displayName: "Admin (Operations)",
    permissions: [
      "category:manage",
      "seller:create_test_seller",
      "product:create_for_test",
      "order:manage",
      "refund:process",
      "dispute:resolve",
    ],
  },

  // Admin - Analytics
  ADMIN_ANALYTICS: {
    name: "ADMIN_ANALYTICS",
    displayName: "Admin (Analytics)",
    permissions: [
      "analytics:view_all_dashboards",
      "analytics:export_data",
      "seller:view_all",
      "seller:view_performance",
      "product:view_all",
      "order:view_all",
    ],
  },

  // Super Admin
  SUPER_ADMIN: {
    name: "SUPER_ADMIN",
    displayName: "Super Admin",
    permissions: ["*"], // All permissions
  },
};
```

---

## III. Detailed Workflows

### 3.1 Seller Onboarding Workflow (Complete Flow)

#### **Step 1: User Registers (Default BUYER)**

```
[User visits marketplace]
  ↓
[Clicks "Sign up"]
  ↓
[Fills email, password, display name]
  ↓
[System creates User with role = BUYER]
  ↓
[Send verification email]
  ↓
[User clicks link to verify]
  ↓
[Email marked verified]
```

**API Endpoint:**
```http
POST /api/auth/register
{
  "email": "seller@example.com",
  "password": "...",
  "displayName": "John Seller"
}

Response (201):
{
  "userId": "user-123",
  "email": "seller@example.com",
  "roles": ["BUYER"],
  "status": "PENDING_VERIFICATION"
}
```

---

#### **Step 2: User Applies to Become Seller**

```
[User navigates to "Become a Seller" page]
  ↓
[Fills out seller form]
  - Shop name (e.g., "John's Electronics")
  - Shop description
  - Shop category (Electronics, Books, etc.)
  - Phone number
  - Agrees to seller terms
  ↓
[System validates]
  - Shop name unique?
  - Email already verified?
  - User in good standing? (not banned)
  ↓
[System creates SellerProfile]
  - status = PENDING_VERIFICATION
  - tier = INDIVIDUAL
  ↓
[Assigns SELLER role to user (temporary, pending approval)]
  ↓
[Sends admin notification: "New seller application"]
  ↓
[User sees status: "Awaiting Seller Verification"]
```

**API Endpoint:**
```http
POST /api/sellers/apply
Authorization: Bearer {accessToken}
{
  "shopName": "John's Electronics",
  "shopDescription": "Premium electronics at best prices",
  "shopCategory": "electronics",
  "phoneNumber": "+84-0123456789",
  "agreeToTerms": true
}

Response (201):
{
  "id": "seller-456",
  "userId": "user-123",
  "shopName": "John's Electronics",
  "status": "PENDING_VERIFICATION",
  "tier": "INDIVIDUAL",
  "message": "Your seller application is under review. We'll notify you soon."
}
```

---

#### **Step 3: Admin Reviews Seller Application**

```
[Admin navigates to "Seller Applications" dashboard]
  ↓
[Admin views list of PENDING_VERIFICATION sellers]
  ↓
[Admin clicks on seller profile]
  ↓
[Admin can see]
  - Seller info
  - Email verification status
  - Shop details
  - Reason (if previously rejected)
  ↓
[Admin decision:]

  OPTION A: APPROVE
  ↓
  [System]
    - SellerProfile.status = VERIFIED
    - SellerProfile.tier = INDIVIDUAL (or MERCHANT)
    - Assign permanent SELLER role
    - Remove temporary SELLER_PENDING role
  ↓
  [Send email to seller]
    "Congratulations! Your seller account is approved.
     You can now start uploading products."
  ↓
  [Event published: seller.verified.v1]

  OPTION B: REJECT
  ↓
  [System asks admin for reason]
  ↓
  [Admin enters rejection reason]
    e.g., "Phone number doesn't match ID"
  ↓
  [SellerProfile.status = REJECTED]
  ↓
  [Send email to seller with reason + how to reapply]
  ↓
  [Event published: seller.rejected.v1]
```

**API Endpoint (Admin):**
```http
PATCH /api/admin/sellers/{sellerId}/verify
Authorization: Bearer {adminToken}
{
  "decision": "APPROVED",
  "tier": "INDIVIDUAL",
  "reason": "All documents verified"
}

Response (200):
{
  "sellerId": "seller-456",
  "status": "VERIFIED",
  "message": "Seller approved. Email sent."
}
```

---

#### **Step 4: Seller Explores Dashboard**

```
[Seller logs in]
  ↓
[Dashboard shows]
  - "Welcome! Your shop is live"
  - Quick actions: Upload product, View analytics
  - Stats: 0 products, 0 orders, 0 reviews
  - Shop URL: https://marketplace.com/shop/johns-electronics
  ↓
[Seller can now]
  - Create products
  - Manage shop profile
  - View shop analytics
  - Receive notifications
```

---

### 3.2 Product Upload & Approval Workflow

#### **Flow: Seller uploads product → Admin approves → Buyer sees it**

```
┌─────────────────────────────────────────────────────────────┐
│                 SELLER CREATES PRODUCT                      │
└─────────────────────────────────────────────────────────────┘

[Seller clicks "Upload Product"]
  ↓
[Form: Title, Description, Price, Stock, Images, Category]
  ↓
[System validates]
  - Title length: 10-200 chars
  - Price > 0
  - Stock >= 0
  - At least 1 image uploaded
  - Seller status = VERIFIED
  ↓
[System creates Product]
  - status = DRAFT (seller can edit)
  - sellerId = seller's userId
  - createdAt = now
  ↓
[Seller sees product in "My Products" → Draft tab]
  ↓
[Seller can edit/delete (only in DRAFT)]
  ↓
[Seller clicks "Submit for Approval"]

┌─────────────────────────────────────────────────────────────┐
│                PRODUCT PENDING APPROVAL                     │
└─────────────────────────────────────────────────────────────┘

[Product status changes: DRAFT → PENDING_APPROVAL]
  ↓
[Event published: product.submitted_for_approval.v1]
  ↓
[Admin dashboard shows notification: "New product pending review"]
  ↓
[Admin navigates to "Products to Review"]
  ↓
[Admin clicks product to view]
  - Title, description, price, images
  - Seller info
  - Category
  ↓
[Admin checks against policies]
  - Is product title clear? (not spam)
  - Are images high quality? (not blurry)
  - Is price reasonable? (not exploitative)
  - Category appropriate?
  - No prohibited items?
  ↓
[Admin decision:]

  OPTION A: APPROVE
  ↓
  [Product status: PENDING_APPROVAL → APPROVED]
  ↓
  [Product becomes visible in search]
  ↓
  [Event published: product.approved.v1]
  ↓
  [Email to seller: "Your product was approved!"]

  OPTION B: REJECT
  ↓
  [Product status: PENDING_APPROVAL → REJECTED]
  ↓
  [Admin must enter reason]
  ↓
  [Product NOT visible in search]
  ↓
  [Event published: product.rejected.v1]
  ↓
  [Email to seller: "Your product was rejected. Reason: ..."]
  ↓
  [Seller can edit and resubmit]

┌─────────────────────────────────────────────────────────────┐
│              PRODUCT VISIBLE TO BUYERS                      │
└─────────────────────────────────────────────────────────────┘

[Buyers search/browse]
  ↓
[See APPROVED products only]
  ↓
[Click product to view detail]
  ↓
[Can add to cart]
```

---

### 3.3 Search & Discovery Workflow (Buyer Perspective)

```
┌─────────────────────────────────────────────────────────────┐
│              BUYER SEARCHES FOR PRODUCT                     │
└─────────────────────────────────────────────────────────────┘

[Buyer types "iPhone" in search box]
  ↓
[System queries]
  - status = APPROVED
  - isActive = true
  - Full-text match on title/description/tags
  - seller.status = VERIFIED
  ↓
[Returns 50 matching APPROVED products]
  ↓
[Display with filters panel]
  - Price range (slider): $500-$1500
  - Brand: [Apple, Samsung, Xiaomi, ...]
  - Seller rating: [4+ stars, 3+ stars, ...]
  - Condition: [New, Used, ...]
  ↓
[Buyer applies filters]
  - Price: $800-$1200
  - Brand: Apple
  - Seller rating: 4.5+ stars
  ↓
[Results narrowed to 12 products]
  ↓
[Sort options]
  - Relevance (default)
  - Newest
  - Price: Low to High
  - Price: High to Low
  - Rating: High to Low
  ↓
[Buyer sorts by "Price: Low to High"]
  ↓
[Products re-sorted]
  ↓
[Buyer clicks on first product]

┌─────────────────────────────────────────────────────────────┐
│              BUYER VIEWS PRODUCT DETAIL                     │
└─────────────────────────────────────────────────────────────┘

[Product detail page shows]
  - Title, description
  - Images (gallery)
  - Price: $999
  - Stock: 5 remaining
  - Seller info:
    - Shop name: "Apple Official Store"
    - Rating: 4.8/5 (based on 320 reviews)
    - Response time: < 2 hours
    - Joined: 2 years ago
  - Attributes: Color (Gold), Storage (256GB)
  - Reviews & ratings from other buyers
  - "Add to Cart" button
  ↓
[Buyer can]
  - Add to wishlist
  - Share product
  - Ask seller question
  - View seller's other products
```

---

### 3.4 Admin Moderation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│               ADMIN MONITORING DASHBOARD                    │
└─────────────────────────────────────────────────────────────┘

[Admin (ADMIN_MODERATOR role) logs in]
  ↓
[Dashboard shows]
  - Products pending review: 15
  - Flagged products (low quality): 8
  - Sellers pending verification: 3
  - Flagged sellers (low rating): 2
  - Recent reviews flagged as inappropriate: 12
  ↓
[Tabs available]
  - Products to Review
  - Sellers to Review
  - Flagged Content
  - Reports & Appeals
  ↓
[Admin navigates to "Flagged Products"]
  ↓
[Shows products with issues]
  - Blurry images
  - Misleading title
  - Suspected counterfeit
  - Policy violation
  ↓
[Admin can]
  - Remove product (DELISTED)
  - Ask seller to fix
  - Send warning
  - Suspend seller if repeated issues
  ↓
[Actions logged in audit trail]
```

---

### 3.5 Seller Suspension/Ban Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              WHEN SELLER VIOLATES POLICY                    │
└─────────────────────────────────────────────────────────────┘

[Scenario: Seller has 5 negative reviews in 1 week]
  ↓
[System flags seller]
  ↓
[Admin reviews seller profile]
  ↓
[Admin sees issues]
  - Many fake items
  - Buyers reporting scam
  - Slow shipping
  ↓
[Admin decision: SUSPEND seller]
  ↓
[System]
  - Seller status: VERIFIED → SUSPENDED
  - All products: status → DELISTED (not visible)
  - Seller can't create new products
  - SellerTier: INDIVIDUAL → (kept same, but functionality limited)
  ↓
[Email to seller]
  "Your shop has been suspended. Reason: ...
   You can appeal within 30 days."
  ↓
[Event published: seller.suspended.v1]
  ↓
[Products disappear from search results]
  ↓
[Buyers' active orders still proceed normally]

┌─────────────────────────────────────────────────────────────┐
│                   SELLER APPEALS                            │
└─────────────────────────────────────────────────────────────┘

[Seller submits appeal]
  - "I've improved my quality. Please review."
  ↓
[Admin reviews appeal]
  ↓
[Admin can]
  - Reject appeal (suspension continues)
  - Accept appeal (SUSPENDED → VERIFIED)
  - Reduce suspension time
  - Ban permanently (SUSPENDED → BANNED)
  ↓
[If accepted]
  - Seller status: SUSPENDED → VERIFIED
  - Products: DELISTED → APPROVED (if previously APPROVED)
  - Email: "Your appeal was accepted. Shop is live again."
```

---

## IV. Design Patterns for Scalability

### 4.1 Strategy Pattern (for different seller types)

```typescript
// Strategy for different seller tiers
interface SellerStrategy {
  canBulkUpload(): boolean;
  canUseFeaturedPlacement(): boolean;
  getCommissionRate(): number;
  getDailyProductLimit(): number;
  getResponseTimeTarget(): number; // hours
}

class IndividualSellerStrategy implements SellerStrategy {
  canBulkUpload() { return false; }
  canUseFeaturedPlacement() { return false; }
  getCommissionRate() { return 0.15; } // 15%
  getDailyProductLimit() { return 10; }
  getResponseTimeTarget() { return 48; } // 48 hours
}

class MerchantSellerStrategy implements SellerStrategy {
  canBulkUpload() { return true; }
  canUseFeaturedPlacement() { return true; }
  getCommissionRate() { return 0.12; } // 12%
  getDailyProductLimit() { return 100; }
  getResponseTimeTarget() { return 24; } // 24 hours
}

class PremiumSellerStrategy implements SellerStrategy {
  canBulkUpload() { return true; }
  canUseFeaturedPlacement() { return true; }
  getCommissionRate() { return 0.10; } // 10%
  getDailyProductLimit() { return 500; }
  getResponseTimeTarget() { return 4; } // 4 hours
}

// Usage in service
async createProduct(sellerId: string, input: CreateProductDto) {
  const seller = await this.getSellerProfile(sellerId);
  const strategy = this.getStrategyForTier(seller.tier);
  
  // Check rate limiting
  const productsToday = await this.getProductsUploadedToday(sellerId);
  if (productsToday >= strategy.getDailyProductLimit()) {
    throw new Error("Daily limit exceeded");
  }
  
  return this.productService.create({
    ...input,
    sellerId,
    commissionRate: strategy.getCommissionRate(),
  });
}
```

---

### 4.2 Decorator Pattern (for permission checking)

```typescript
// Decorator to check permission
function RequirePermission(permission: string) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const req = args[0]; // Assume NestJS @Req()
      const user = req.user; // JWT payload
      
      // Check if user has permission
      const hasPermission = await this.permissionService.hasPermission(
        user.id,
        permission
      );
      
      if (!hasPermission) {
        throw new ForbiddenException(`Missing permission: ${permission}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

// Usage
@Controller('products')
export class ProductsController {
  @Post()
  @RequirePermission('product:create')
  async createProduct(@Body() dto: CreateProductDto, @Req() req: Request) {
    // Only runs if user has 'product:create' permission
    return this.productService.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @RequirePermission('product:approve_pending')
  async approveProduct(@Param('id') productId: string) {
    // Only admin moderators can call this
    return this.productService.approve(productId);
  }
}
```

---

### 4.3 Command Pattern (for audit trail)

```typescript
// Command interface
interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
  getDescription(): string;
}

// Concrete commands
class ApproveProductCommand implements Command {
  constructor(
    private productId: string,
    private adminId: string,
    private reason: string,
    private productService: ProductService,
    private auditService: AuditService
  ) {}

  async execute() {
    await this.productService.approve(this.productId);
    await this.auditService.log({
      userId: this.adminId,
      action: 'product:approved',
      resourceId: this.productId,
      metadata: { reason: this.reason },
    });
  }

  async undo() {
    await this.productService.rejectProduct(this.productId, 'Admin undo');
  }

  getDescription() {
    return `Approved product ${this.productId}`;
  }
}

class SuspendSellerCommand implements Command {
  constructor(
    private sellerId: string,
    private adminId: string,
    private reason: string,
    private sellerService: SellerService,
    private auditService: AuditService
  ) {}

  async execute() {
    await this.sellerService.suspend(this.sellerId, this.reason);
    await this.auditService.log({
      userId: this.adminId,
      action: 'seller:suspended',
      resourceId: this.sellerId,
      metadata: { reason: this.reason },
    });
  }

  async undo() {
    await this.sellerService.unsuspend(this.sellerId);
  }

  getDescription() {
    return `Suspended seller ${this.sellerId}`;
  }
}

// Command queue for auditing
class CommandHistory {
  private history: Command[] = [];

  execute(command: Command) {
    command.execute();
    this.history.push(command);
  }

  undo() {
    const lastCommand = this.history.pop();
    if (lastCommand) {
      lastCommand.undo();
    }
  }

  getHistory() {
    return this.history.map(c => c.getDescription());
  }
}
```

---

### 4.4 Policy Pattern (for business rules)

```typescript
// Policies for what sellers can do
interface SellerPolicy {
  canUploadProducts(): boolean;
  canDeleteProducts(): boolean;
  canUseBulkOperations(): boolean;
  canRunPromotions(): boolean;
  canViewAnalytics(): boolean;
}

class VerifiedSellerPolicy implements SellerPolicy {
  constructor(private seller: SellerProfile) {}

  canUploadProducts() {
    return this.seller.status === 'VERIFIED' && this.seller.isKycVerified;
  }

  canDeleteProducts() {
    return this.seller.status === 'VERIFIED';
  }

  canUseBulkOperations() {
    return false; // Individual sellers can't bulk upload
  }

  canRunPromotions() {
    return this.seller.status === 'VERIFIED';
  }

  canViewAnalytics() {
    return this.seller.status === 'VERIFIED';
  }
}

class PremiumSellerPolicy implements SellerPolicy {
  constructor(private seller: SellerProfile) {}

  canUploadProducts() {
    return true;
  }

  canDeleteProducts() {
    return true;
  }

  canUseBulkOperations() {
    return true; // Premium sellers can bulk upload
  }

  canRunPromotions() {
    return true;
  }

  canViewAnalytics() {
    return true;
  }
}

// Usage
async uploadProduct(seller: SellerProfile, input: CreateProductDto) {
  const policy = this.getPolicies(seller);
  
  if (!policy.canUploadProducts()) {
    throw new Error("You don't have permission to upload products");
  }
  
  return this.productService.create(input);
}
```

---

## V. Permission Checking in Practice

### 5.1 Middleware for Permission Validation

```typescript
// auth.middleware.ts
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private permissionService: PermissionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Verify JWT and extract user
    const user = this.jwtService.verify(token);
    
    // Load user roles & permissions
    const roles = await this.permissionService.getUserRoles(user.id);
    const permissions = await this.permissionService.getUserPermissions(user.id);
    
    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      roles,
      permissions,
    };
    
    next();
  }
}

// Guard to check specific permission
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    
    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return user.permissions.includes(requiredPermission);
  }
}

// Usage
@Controller('products')
export class ProductsController {
  @Post()
  @SetMetadata('permission', 'product:create')
  @UseGuards(PermissionGuard)
  async createProduct(@Body() dto: CreateProductDto, @Req() req: Request) {
    return this.productService.create(dto, req.user.id);
  }
}
```

---

### 5.2 Service Layer Permission Checking

```typescript
// products.service.ts
@Injectable()
export class ProductsService {
  async createProduct(
    userId: string,
    input: CreateProductDto
  ): Promise<Product> {
    // 1. Get seller profile
    const seller = await this.sellerService.getProfile(userId);
    
    if (!seller) {
      throw new BadRequestException('Not a seller');
    }

    // 2. Check seller status
    if (seller.status !== 'VERIFIED') {
      throw new ForbiddenException('Seller account not verified');
    }

    // 3. Check rate limiting
    const policy = this.getPolicyForTier(seller.tier);
    const todayCount = await this.getProductsUploadedToday(userId);
    if (todayCount >= policy.getDailyProductLimit()) {
      throw new BadRequestException('Daily limit exceeded');
    }

    // 4. Validate input
    this.validateProductInput(input);

    // 5. Create product
    const product = await this.productModel.create({
      sellerId: userId,
      ...input,
      status: 'DRAFT',
      slug: this.generateSlug(input.title),
    });

    return product;
  }

  async approveProduct(
    adminId: string,
    productId: string,
    reason: string
  ): Promise<Product> {
    // 1. Check admin permission
    const admin = await this.userService.getUser(adminId);
    const hasPermission = await this.permissionService.hasPermission(
      adminId,
      'product:approve_pending'
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // 2. Check product status
    const product = await this.productModel.findById(productId);
    if (product.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Product not pending approval');
    }

    // 3. Update product
    const updated = await this.productModel.findByIdAndUpdate(
      productId,
      { status: 'APPROVED' },
      { new: true }
    );

    // 4. Audit log
    await this.auditService.log({
      userId: adminId,
      action: 'product:approved',
      resourceId: productId,
      metadata: { reason },
    });

    // 5. Publish event
    await this.eventBus.publish('product.approved.v1', {
      productId,
      reason,
      approvedBy: adminId,
    });

    return updated;
  }
}
```

---

## VI. Real-World Example: Amazon's Role Model

### 6.1 How Amazon Structures Roles

```
Individual Seller Account
├─ Can list up to 40 products/month
├─ Limited visibility
├─ 15% referral fee
├─ Basic seller central features

Professional Seller Account
├─ Unlimited listings
├─ Full seller central
├─ 15% referral fee (same)
├─ Advertising tools
├─ Fulfillment by Amazon (FBA) option

Vendor (Brand Program)
├─ Amazon buys products from you
├─ You set wholesale price
├─ Amazon sets retail price
├─ Amazon handles fulfillment
├─ Higher tier than seller

Associates (Affiliates)
├─ Promote products
├─ Earn commission per sale
├─ Can't sell directly

Amazon Business
├─ B2B bulk selling
├─ Special pricing
├─ Invoice system

Admin Roles
├─ Seller Operations (manage sellers)
├─ Trust & Safety (moderation)
├─ Finance (payments)
├─ Analytics
```

---

## VII. Implementation Roadmap

### Phase 1: MVP (Week 1-2)

**Must have:**
- ✅ Extend Role-Permission system (3-layer RBAC)
- ✅ Create UserRole many-to-many model
- ✅ Define 5 core roles: BUYER, SELLER, SELLER_PREMIUM, ADMIN_MODERATOR, SUPER_ADMIN
- ✅ Implement PermissionGuard middleware
- ✅ Build permission checking in service layer

### Phase 1.1 (Week 3)

- ✅ Add SellerTier enum (INDIVIDUAL, MERCHANT, PREMIUM)
- ✅ Implement seller policies (Strategy pattern)
- ✅ Rate limiting per tier
- ✅ Admin board for seller verification

### Phase 2 (Week 4-6)

- ✅ Add AFFILIATE role (dropshipping)
- ✅ LOGISTICS_PARTNER role
- ✅ Permission inheritance (SELLER_PREMIUM inherits SELLER)
- ✅ Audit logging with Command pattern
- ✅ Permission history & rollback

### Phase 3+ (Week 7+)

- ✅ Dynamic permission assignment
- ✅ Time-based roles (e.g., "Temporary events organizer" for 1 week)
- ✅ Organization-based roles (seller org with multiple users)
- ✅ Fine-grained resource permissions (can edit specific product categories only)

---

## VIII. Summary: Why This Matters

**Before (Simple Enum):** Limited, inflexible, can't scale to real-world complexity  
**After (3-Layer RBAC):** Flexible, granular, extensible, mirrors real platforms

Your marketplace can now handle:
- ✅ Multiple seller tiers with different features
- ✅ Admin teams with specialized roles
- ✅ Future extension (affiliates, logistics partners, etc.)
- ✅ Permission delegation & inheritance
- ✅ Audit trails for compliance
- ✅ Dynamic role & permission management

---

**Document Status:** Production-ready design  
**Last Updated:** April 28, 2026  
**Complexity Level:** Intermediate to Advanced
