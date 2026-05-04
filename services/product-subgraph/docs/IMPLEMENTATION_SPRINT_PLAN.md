# Implementation Sprint Plan - Marketplace MVP

**Date:** May 3, 2026  
**Current State:** product-subgraph v1.0 (REST + MongoDB + 30/30 tests) ✅  
**Goal:** Build marketplace with RBAC, seller onboarding, product approval workflow  
**Timeline:** Next 6 weeks (3 sprints × 2 weeks)

---

## I. Current State Assessment

### 1.1 What We Have ✅

**Product-Subgraph (v1.0 STABLE):**
- REST API: 5 endpoints (GET /products, POST, PUT, DELETE, GET detail)
- MongoDB: basic product model (id, title, price, stock)
- Tests: 30/30 passing (unit + E2E)
- Mongoose: async/await throughout
- Validation: 2-layer (DTO + schema)

**User-Service (EXISTING):**
- Authentication: register/login/refresh token
- Prisma schema: User model with email, password, profile
- REST endpoints for user management

**Architecture:**
- Microservices: product-subgraph, user-service, plus others
- Database: MongoDB (products), Postgres (users)
- Tests: Jest + MongoMemoryServer (isolated)
- No role system yet (just single User model)

### 1.2 What We Need ❌

**To build MVP Marketplace, missing:**
1. ❌ User roles (BUYER, SELLER, ADMIN)
2. ❌ SellerProfile model in user-service
3. ❌ Product.sellerId linking
4. ❌ Product approval workflow (DRAFT → PENDING → APPROVED)
5. ❌ Search/filter/sort (full-text, price range, category)
6. ❌ Admin dashboard for seller verification
7. ❌ Permission guards (authorization checks)
8. ❌ Event publishing (RabbitMQ for seller notifications)
9. ❌ Seller tier system (INDIVIDUAL, MERCHANT, PREMIUM)
10. ❌ Pagination

---

## II. Dependency Map

```
Sprint 1 (Week 1-2)
├─ Task 1: Extend User model (add Role + SellerProfile)
├─ Task 2: Update Product schema (add sellerId, status, categoryId, attributes, slug, tags)
├─ Task 3: Implement permission middleware (auth checking)
└─ Task 4: Product CRUD with seller validation

Sprint 2 (Week 3-4)
├─ Task 5: Product approval workflow (DRAFT → PENDING → APPROVED)
├─ Task 6: Admin approve/reject endpoint
├─ Task 7: Full-text search + filters + sorting
├─ Task 8: Pagination
└─ Task 9: Permission guard for all endpoints

Sprint 3 (Week 5-6)
├─ Task 10: Seller profile management endpoint
├─ Task 11: Seller onboarding flow (apply → verify)
├─ Task 12: Event publishing (product.approved, seller.verified)
├─ Task 13: Seller tier & rate limiting
└─ Task 14: Admin dashboard API (sellers to review, products pending, etc.)
```

---

## III. Recommended First Sprint (Week 1-2)

### **Goal:** Establish foundation (Users + Roles + Basic Product CRUD with seller ownership)

**Sprint 1 Backlog:**
1. **Task 1.1:** Extend User schema (user-service)
2. **Task 1.2:** Update Product schema (product-subgraph)
3. **Task 1.3:** Permission middleware implementation
4. **Task 1.4:** Security: seller validation on product create
5. **Task 1.5:** Tests: 15+ new test cases

---

## IV. Detailed Sprint 1 Breakdown

### Task 1.1: Extend User Schema with Roles & SellerProfile

**Effort:** 8 hours  
**Dependency:** None (prerequisite for everything)  
**Files to modify:**
- `user-service/prisma/schema.prisma` (add Role enum, UserRole, SellerProfile)
- `user-service/src/db/migrations/` (Prisma migration)

**What to do:**

```bash
# 1. Update schema.prisma
prisma/schema.prisma:
  ├─ Add enum Role { BUYER, SELLER, ADMIN }
  ├─ Add model UserRole (many-to-many User → Role)
  ├─ Add model SellerProfile (1-to-1 with User)
  ├─ Add model Permission, RolePermission (for future RBAC)
  └─ Add model AuditLog

# 2. Create migration
pnpm --filter user-service exec prisma migrate dev --name "add_roles_seller_profile"

# 3. Seed default roles (BUYER, SELLER, ADMIN_MODERATOR)
user-service/src/seed/roles.seed.ts:
  ├─ Create BUY role with permissions: [product:view, review:create]
  ├─ Create SELLER role with permissions: [product:create, product:edit_own]
  └─ Create ADMIN_MODERATOR role with permissions: [product:approve, seller:suspend]

# 4. Update user creation endpoint
user-service/src/modules/users/users.service.ts:
  ├─ On register: assign role = BUYER by default
  └─ On updateMe: allow role change logic (future)

# 5. Tests
user-service/src/modules/users/users.service.spec.ts:
  ├─ Test user created with BUYER role
  ├─ Test SellerProfile creation
  ├─ Test role assignment
  └─ (Total: 5 new tests)
```

**Prisma Schema to Add:**

```prisma
enum Role {
  BUYER
  SELLER
  ADMIN_MODERATOR
  ADMIN_OPERATIONS
  ADMIN_ANALYTICS
  SUPER_ADMIN
}

model UserRole {
  id        String   @id @default(uuid())
  userId    String
  roleId    String
  assignedAt DateTime @default(now())
  expiresAt DateTime?
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role     @relation(fields: [roleId], references: [id])
  
  @@unique([userId, roleId])
  @@map("user_roles")
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  displayName String
  description String?
  isPublic    Boolean  @default(true)
  
  permissions RolePermission[]
  users       UserRole[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("roles")
}

model SellerProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  shopName      String   @unique
  shopDesc      String?
  
  status        SellerStatus @default(PENDING_VERIFICATION)
  // PENDING_VERIFICATION | VERIFIED | SUSPENDED | BANNED
  
  tier          SellerTier @default(INDIVIDUAL)
  isKycVerified Boolean   @default(false)
  
  totalProducts Int       @default(0)
  totalOrders   Int       @default(0)
  avgRating     Float?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([status])
  @@map("seller_profiles")
}

enum SellerStatus {
  PENDING_VERIFICATION
  VERIFIED
  SUSPENDED
  BANNED
}

enum SellerTier {
  INDIVIDUAL
  MERCHANT
  BRAND_PARTNER
  PREMIUM
}

model Permission {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  category    String   // "product", "seller", "admin"
  
  roles       RolePermission[]
  
  @@map("permissions")
}

model RolePermission {
  id           String   @id @default(uuid())
  roleId       String
  permissionId String
  
  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@unique([roleId, permissionId])
  @@map("role_permissions")
}

model AuditLog {
  id        String   @id @default(uuid())
  userId    String?
  action    String
  resourceId String?
  metadata  Json?
  
  createdAt DateTime @default(now())
  
  @@map("audit_logs")
}

// Update User model
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  displayName  String
  
  // NEW
  roles        UserRole[]
  sellerProfile SellerProfile?
  auditLogs    AuditLog[]
  
  // ... existing fields ...
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@map("users")
}
```

**Acceptance Criteria:**
- ✅ Prisma migration runs successfully
- ✅ Default roles seeded (BUYER, SELLER, ADMIN_MODERATOR)
- ✅ New users assigned BUYER role on registration
- ✅ SellerProfile can be created for a SELLER user
- ✅ 5 new unit tests pass

---

### Task 1.2: Update Product Schema with Seller Ownership

**Effort:** 6 hours  
**Dependency:** Task 1.1 (need to know user structure)  
**Files to modify:**
- `product-subgraph/src/products/product.schema.ts`
- `product-subgraph/src/products/product.type.ts`
- `product-subgraph/src/products/dto/create-product.dto.ts`

**What to do:**

```bash
# 1. Update Mongoose schema
product.schema.ts:
  ├─ Add @Prop({ required: true }) sellerId: string
  ├─ Add @Prop() categoryId?: string
  ├─ Add @Prop({ enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'DELISTED'] }) status: string
  ├─ Add @Prop({ unique: true }) slug: string
  ├─ Add @Prop({ type: Array }) tags: string[]
  ├─ Add @Prop({ type: Object }) attributes: Record<string, any>
  └─ Add ProductSchema.index({ sellerId: 1 }, sellerId, status, categoryId, createdAt, full-text on title)

# 2. Update type definition
product.type.ts:
  └─ Add sellerId, categoryId, status, slug, tags, attributes

# 3. Update DTO
create-product.dto.ts:
  ├─ Add categoryId?: string
  ├─ Add tags?: string[]
  ├─ Add attributes?: Record<string, any>
  └─ Remove id, sellerId, status (auto-generated/assigned)

# 4. Controller gets sellerId from JWT
products.controller.ts:
  ├─ Extract userId from @Req() req.user.id
  └─ Pass to service as sellerId (not from user input)

# 5. Tests
product.schema.spec.ts:
  ├─ Test schema validation: sellerId required
  ├─ Test status enum: only valid statuses
  ├─ Test slug unique
  ├─ Test full-text index on title/tags
  └─ (Total: 5 new tests in schema validation)
```

**Updated Product Schema:**

```typescript
@Schema({ versionKey: false, timestamps: true })
export class Product {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  sellerId!: string;  // FK to User.id

  @Prop()
  categoryId?: string;

  @Prop({ required: true })
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

  @Prop({ type: Date, default: Date.now })
  createdAt?: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt?: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes
ProductSchema.index({ sellerId: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ slug: 1 });
ProductSchema.index({ title: 'text', description: 'text', tags: 'text' });
```

**Acceptance Criteria:**
- ✅ Schema migration: existing products still work (or deleted for fresh start)
- ✅ New products tracked by sellerId
- ✅ Status enum enforced (only valid values)
- ✅ Indexes created for search/filter performance
- ✅ 5 new schema validation tests pass

---

### Task 1.3: Permission Middleware & Guards

**Effort:** 6 hours  
**Dependency:** Task 1.1 (need User roles)  
**Files to create:**
- `product-subgraph/src/common/guards/permission.guard.ts`
- `product-subgraph/src/common/decorators/require-permission.decorator.ts`
- `product-subgraph/src/common/services/permission.service.ts`

**What to do:**

```bash
# 1. Create Permission Service
permission.service.ts:
  ├─ async hasPermission(userId, permission): boolean
  ├─ async getAllPermissionsForUser(userId): string[]
  └─ Call user-service to get user roles/permissions (via HTTP)

# 2. Create Permission Guard
permission.guard.ts:
  ├─ Check @Require-Permission() decorator on controller method
  ├─ Extract user from @Req()
  ├─ Call permissionService.hasPermission()
  ├─ If unauthorized: throw ForbiddenException
  └─ If authorized: continue

# 3. Create Decorator
require-permission.decorator.ts:
  ├─ @RequirePermission(permission: string)
  └─ Attaches metadata for guard to read

# 4. Auth Middleware (optional, enhance existing)
auth.middleware.ts:
  ├─ Extract JWT token
  ├─ Decode user info
  ├─ Attach to req.user = { id, email, roles }
  └─ Call next()

# 5. Tests
permission.guard.spec.ts:
  ├─ Test: user with permission → allowed
  ├─ Test: user without permission → 403 Forbidden
  ├─ Test: no @RequirePermission() → always allowed
  ├─ Test: invalid token → 401 Unauthorized
  └─ (Total: 5 new tests)
```

**Sample Code:**

```typescript
// require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (permission: string) =>
  SetMetadata('permission', permission);

// permission.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );

    if (!requiredPermission) {
      return true; // No permission required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No user context');
    }

    const hasPermission = await this.permissionService.hasPermission(
      user.id,
      requiredPermission,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission: ${requiredPermission}`,
      );
    }

    return true;
  }
}

// permission.service.ts
@Injectable()
export class PermissionService {
  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const userService = this.configService.get('USER_SERVICE_URL');
      const response = await this.httpService
        .get(`${userService}/api/users/${userId}/permissions`)
        .toPromise();

      const permissions: string[] = response.data.permissions;
      return permissions.includes(permission);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }
}

// Usage in controller
@Controller('products')
@UseGuards(PermissionGuard)
export class ProductsController {
  @Post()
  @RequirePermission('product:create')
  async createProduct(@Body() dto: CreateProductDto, @Req() req: Request) {
    return this.productService.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @RequirePermission('product:approve_pending')
  async approveProduct(@Param('id') productId: string) {
    return this.productService.approve(productId);
  }
}
```

**Acceptance Criteria:**
- ✅ Permission decorator works
- ✅ Guard checks permission via user-service call
- ✅ ForbiddenException thrown for unauthorized users
- ✅ 5 new unit tests pass

---

### Task 1.4: Seller Validation on Product Create

**Effort:** 4 hours  
**Dependency:** Task 1.1, 1.2, 1.3  
**Files to modify:**
- `product-subgraph/src/products/products.service.ts`
- `product-subgraph/src/products/products.controller.ts`

**What to do:**

```bash
# 1. Service: Validate seller before create
products.service.ts:
  ├─ Before creating product:
  │  ├─ 1. Check user has SELLER role (via permission check)
  │  ├─ 2. Fetch seller profile from user-service
  │  ├─ 3. Check seller.status == 'VERIFIED'
  │  ├─ 4. Check seller KYC verified (if future requirement)
  │  └─ If any check fails → throw BadRequestException
  ├─ On create:
  │  ├─ Set product.sellerId = userId
  │  ├─ Set product.status = 'DRAFT'
  │  ├─ Generate slug from title
  │  └─ Return product
  └─ Generate slug: lowercase, replace spaces with -, truncate to 120 chars

# 2. Controller: Extract sellerId from JWT
products.controller.ts:
  ├─ @Post() createProduct(@Body() dto, @Req() req)
  ├─ sellerId = req.user.id
  └─ Pass to service

# 3. Tests
products.service.spec.ts:
  ├─ Test: seller verified → create succeeds
  ├─ Test: seller pending verification → 400 error
  ├─ Test: seller banned → 400 error
  ├─ Test: product has correct sellerId
  ├─ Test: product status = DRAFT initially
  └─ (Total: 5 new tests)

products.controller.spec.ts:
  ├─ Test: POST /products with valid JWT → success
  ├─ Test: POST /products without JWT → 401
  └─ (Total: 2 new tests)
```

**Updated Service Method:**

```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private httpClient: HttpService,
    private configService: ConfigService,
  ) {}

  async createProduct(
    userId: string,
    input: CreateProductDto,
  ): Promise<Product> {
    // 1. Validate user is seller
    const userServiceUrl = this.configService.get('USER_SERVICE_URL');
    
    try {
      const userResponse = await this.httpClient
        .get(`${userServiceUrl}/api/users/${userId}`)
        .toPromise();
      const user = userResponse.data;

      // 2. Check seller profile exists & verified
      if (!user.sellerProfile) {
        throw new BadRequestException('User is not a seller');
      }

      if (user.sellerProfile.status !== 'VERIFIED') {
        throw new BadRequestException(
          'Seller account must be verified before uploading products',
        );
      }

      // 3. Validate input
      this.validateCreateProductInput(input);

      // 4. Generate slug
      const slug = this.generateSlug(input.title);

      // 5. Create product
      const product = await this.productModel.create({
        sellerId: userId,
        ...input,
        slug,
        status: 'DRAFT',
      });

      return product;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 120);
  }

  private validateCreateProductInput(input: CreateProductDto) {
    if (input.title.length < 10 || input.title.length > 200) {
      throw new BadRequestException(
        'Title must be 10-200 characters',
      );
    }
    if (input.price < 0) {
      throw new BadRequestException('Price must be non-negative');
    }
    if (input.stock < 0) {
      throw new BadRequestException('Stock must be non-negative');
    }
  }

  // ... rest of methods
}
```

**Acceptance Criteria:**
- ✅ Only verified sellers can create products
- ✅ Product.sellerId auto-assigned from JWT
- ✅ Product.status = DRAFT on creation
- ✅ Slug generated correctly from title
- ✅ 7 new unit tests pass

---

### Task 1.5: Comprehensive Tests (Sprint 1 Validation)

**Effort:** 5 hours  
**Dependency:** All Task 1.1-1.4 complete  
**Files to create/update:**
- All `*.spec.ts` files (unit tests)
- `test/app.e2e-spec.ts` (E2E tests)

**What to do:**

```bash
# 1. Unit Tests (total ~15 new tests)
├─ products.service.spec.ts: 5 tests (seller validation, slug generation)
├─ products.controller.spec.ts: 2 tests (JWT extraction, error handling)
├─ permission.guard.spec.ts: 5 tests (permission checks)
└─ user-service roles.service.spec.ts: 3 tests (role assignment)

# 2. E2E Tests (total ~8 new tests)
test/app.e2e-spec.ts:
├─ Test: Register user → assigned BUYER role
├─ Test: BUYER tries to create product → 400 (not seller)
├─ Test: Create SellerProfile → status PENDING_VERIFICATION
├─ Test: Admin approves seller → status VERIFIED
├─ Test: Seller creates product → DRAFT status
├─ Test: DRAFT product not visible to buyer search
██─ Test: Product visible after approval (APPROVED)
└─ Test: Another seller can't modify first seller's product

# 3. Run all tests
pnpm --filter product-subgraph test           # Unit: should be ~35/35
pnpm --filter product-subgraph test:e2e       # E2E: should be ~20/20
pnpm --filter user-service test               # Unit: updated
pnpm --filter product-subgraph lint           # Linting: 0 errors
```

**Test Metrics Target:**
```
Product-Subgraph:
├─ products.service.spec.ts: 10 + 5 = 15 tests
├─ products.controller.spec.ts: 9 + 2 = 11 tests
├─ permission.guard.spec.ts: 5 new tests
└─ Total: 35/35 passing (from 18/18 baseline)

User-Service:
├─ users.service.spec.ts: +3 new tests
└─ Total: 13+ passing (from 10+ baseline)

E2E Tests:
├─ product + user workflows: 8 new tests
└─ Total: 20/20 passing
```

---

## V. Sprint 1 Deliverables & Commit Strategy

### 5.1 Commits (per task)

```bash
# After Task 1.1
git commit -m "feat(user-service): add Role-based access control model

- Add Role, UserRole, SellerProfile, Permission models
- Extend User model with roles and sellerProfile relations
- Create Prisma migration
- Seed default roles: BUYER, SELLER, ADMIN_MODERATOR
- Add 5 unit tests for role assignment
- Tests: 13/13 passing"

# After Task 1.2
git commit -m "feat(product-subgraph): extend product schema with seller tracking

- Add sellerId, categoryId, status, slug, tags, attributes fields
- Add ProductStatus enum: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, DELISTED
- Add database indexes for search performance
- Update DTOs and type definitions
- Add 5 schema validation tests
- Tests: 25/25 passing"

# After Task 1.3
git commit -m "feat(product-subgraph): add permission-based authorization

- Create PermissionGuard for controller-level checks
- Create RequirePermission decorator
- Add PermissionService to check user permissions
- Integrate permission checks with user-service
- Add 5 unit tests for guard functionality
- Tests: 30/30 passing"

# After Task 1.4
git commit -m "fix(product-subgraph): enforce seller validation on product creation

- Check seller profile exists & verified before creating product
- Auto-assign sellerId from JWT (no user input)
- Set product.status = DRAFT on creation
- Implement slug generation from title
- Add 7 new unit tests
- Add 8 new E2E tests
- Tests: 35/35 unit + 20/20 E2E passing"

# Sprint 1 Summary
git tag sprint-1-complete
```

### 5.2 Deployment Readiness

**Before deploying Sprint 1:**
```bash
# 1. Local testing
pnpm install                                    # Update dependencies
pnpm --filter product-subgraph test           # 35/35 ✅
pnpm --filter product-subgraph test:e2e       # 20/20 ✅
pnpm --filter product-subgraph lint           # 0 errors ✅
pnpm --filter user-service test               # All ✅
pnpm --filter user-service lint               # 0 errors ✅

# 2. Docker build & push
docker build -t product-service:sprint1 services/product-subgraph/
docker push registry.example.com/product-service:sprint1

# 3. Deploy to staging
kubectl set image deployment/product-service \
  product-service=registry.example.com/product-service:sprint1

# 4. Smoke tests
curl http://localhost:3000/health           # 200 OK
curl http://localhost:3000/products          # 200 OK (empty array)
```

---

## VI. Sprint 2 Preview (Week 3-4)

**Goal:** Product approval workflow + Search/Filter/Sort

**Tasks:**
- Task 2.1: Product status transitions (DRAFT → PENDING_APPROVAL)
- Task 2.2: Admin approve/reject endpoint
- Task 2.3: Full-text search + filters + sorting on /products endpoint
- Task 2.4: Pagination (limit, offset, page)
- Task 2.5: Tests (20+ new)

**Dependencies:**
- All Sprint 1 tasks complete ✅

---

## VII. Sprint 3 Preview (Week 5-6)

**Goal:** Seller onboarding + Event publishing + Admin dashboard

**Tasks:**
- Task 3.1: Seller profile management API
- Task 3.2: Seller onboarding workflow (apply → admin review → verify)
- Task 3.3: Event publishing (RabbitMQ + notification-worker)
- Task 3.4: Admin dashboard API
- Task 3.5: Seller tier system & rate limiting

**Dependencies:**
- Sprint 1 + 2 complete ✅
- Notification worker ready (parallel work)

---

## VIII. What to Do Right Now (Action Items)

### Immediate (Today)

1. ✅ **Review** all 3 documents:
   - ARCHITECTURE_ANALYSIS.md (current state)
   - ECOMMERCE_MARKETPLACE_DESIGN.md (requirements)
   - ADVANCED_RBAC_AND_WORKFLOWS.md (design patterns)

2. ✅ **Create sprint board** (GitHub Projects or similar):
   ```
   Backlog:
   ├─ Sprint 1 (5 tasks, 29 hours total)
   ├─ Sprint 2 (5 tasks, 25 hours total)
   └─ Sprint 3 (5 tasks, 28 hours total)
   ```

### This Week (Sprint 1 Start)

3. **Start Task 1.1** (Extend User Schema)
   - Create Prisma schema changes
   - Run migration locally
   - Create seed script for roles
   - Write 5 unit tests
   - Commit: `feat(user-service): add RBAC model`

4. **In parallel: Start Task 1.2** (Update Product Schema)
   - Update Mongoose schema
   - Add indexes
   - Update DTOs
   - Write 5 schema tests

5. **Mid-week: Start Task 1.3** (Permission Middleware)
   - Create guard + decorator
   - Implement PermissionService
   - Write 5 guard tests

6. **End of week: Task 1.4 + 1.5** (Seller Validation + Tests)
   - Implement seller validation
   - Write 7 service tests
   - Write 8 E2E tests
   - All tests passing: 35+ unit, 20+ E2E

---

## IX. Resource Allocation

**Estimated time per week:**
```
Sprint 1 (Week 1-2): 29 hours total
├─ Week 1: 
│  ├─ Task 1.1 (User schema): 8 hours
│  ├─ Task 1.2 (Product schema): 6 hours
│  └─ Task 1.3 (Permission middleware): 6 hours
│  └─ Total: 20 hours
└─ Week 2:
   ├─ Task 1.4 (Seller validation): 4 hours
   ├─ Task 1.5 (Tests): 5 hours
   └─ Total: 9 hours

If working part-time (20 hours/week):
├─ Week 1: Complete Tasks 1.1 + partial 1.2
├─ Week 2: Complete Tasks 1.2, 1.3, partial 1.4
└─ Week 3: Complete Tasks 1.4, 1.5
```

---

## X. Risk Mitigation

| Risk | Probability | Mitigation |
|------|------------|-----------|
| Prisma migration fails | Low | Test locally first, backup DB schema |
| Permission service call slow | Medium | Add caching (Redis) + circuit breaker |
| Tests take too long | Low | Run in parallel: `jest --maxWorkers=4` |
| Dependencies between user-service + product-service | Medium | Isolate with HTTP calls + retries |
| Mongoose full-text search issues | Low | Test with sample data before production |

---

## XI. Success Criteria

### For Sprint 1 Complete ✅

- [ ] All unit tests passing: 35+ (product) + 13+ (user)
- [ ] All E2E tests passing: 20+
- [ ] Linting clean: 0 errors/warnings
- [ ] Code review approved (if working with team)
- [ ] Deployed to staging successfully
- [ ] Can create SELLER user + create DRAFT product
- [ ] Can't create product with unverified seller
- [ ] Permission guard working on admin endpoints
- [ ] Documentation updated (README, API docs)

---

**Sprint 1 Status:** Ready to start 🚀  
**Estimated Completion:** May 17, 2026  
**Next Review:** May 10, 2026 (end of week 1)
