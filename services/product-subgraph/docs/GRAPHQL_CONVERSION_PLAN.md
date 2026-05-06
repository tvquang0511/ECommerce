# Product-Subgraph: REST → GraphQL + Auth Conversion Plan

## Overview
- **Goal**: Chuyển product-subgraph từ REST API → GraphQL, tích hợp auth từ user-service
- **Timeline**: ~2-3 weeks (giai đoạn học tập + implementation)
- **Scope P0**: GraphQL query/mutation + Auth Guard
- **Scope P1**: Federation ready (later)

---

## Phase 1: Setup GraphQL Base (2-3 days)

### 1.1 Install Dependencies
```bash
pnpm -C services/product-subgraph add @nestjs/graphql @nestjs/apollo graphql apollo-server-express
pnpm -C services/product-subgraph add -D @types/graphql
```

### 1.2 Create GraphQL TypeDefs
**File**: `src/products/graphql/product.type.ts`
- Define `type Product { id, sellerId, name, price, slug, status, ... }`
- Define `enum ProductStatus { DRAFT, PENDING_REVIEW, APPROVED, REJECTED, ARCHIVED }`
- Define Input types: `CreateProductInput`, `UpdateProductInput`

**File**: `src/products/graphql/product.schema.ts` (or `product.gql`)
- sdl/type definitions cho Query/Mutation

### 1.3 Update App.Module
- Import `GraphQLModule.forRoot()` 
- Set `autoSchemaFile: true` (or point to schema file)
- Pass `context: ({ req }) => ({ req })` để AuthGuard có access req

### 1.4 Verify Apollo Playground
- Run: `pnpm -C services/product-subgraph dev`
- Open: `http://localhost:4002/graphql`
- Should show empty schema initially

**Deliverable**: GraphQL server running, playground accessible
**Effort**: ~1-2 days

---

## Phase 2: AuthContext + Guard Setup (2-3 days)

### 2.1 AuthContext Adapter for GraphQL
**File**: `src/auth/gql-auth.guard.ts`

```typescript
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private authContextService: AuthContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const req = gqlContext.getContext().req;

    const actor = await this.authContextService.getRequiredActor(req);
    gqlContext.getContext().actor = actor; // Store in context
    
    return true; // Authorized
  }
}
```

**Key**: Reuse `AuthContextService.getRequiredActor()` từ REST guard logic

### 2.2 Roles Guard
**File**: `src/auth/gql-roles.guard.ts`

```typescript
@Injectable()
export class GqlRolesGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reflector = new Reflector();
    const requiredRoles = reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true; // No role requirement

    const gqlContext = GqlExecutionContext.create(context);
    const actor = gqlContext.getContext().actor;
    
    if (!actor) throw new UnauthorizedException();
    
    const hasRole = requiredRoles.some(
      role => role === 'SELLER' ? actor.roles.includes('SELLER') 
              : role.startsWith('ADMIN_*') ? actor.roles.some(r => r.startsWith('ADMIN_'))
              : actor.roles.includes(role)
    );
    
    if (!hasRole) throw new ForbiddenException();
    return true;
  }
}
```

### 2.3 CurrentActor Decorator
**File**: `src/auth/decorators/current-actor.decorator.ts`

```typescript
export const CurrentActor = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(context);
    return gqlContext.getContext().actor; // Returns AuthActor
  },
);
```

### 2.4 RequiresRoles Decorator
**File**: `src/auth/decorators/requires-roles.decorator.ts`

```typescript
export const RequiresRoles = (...roles: string[]) => 
  SetMetadata('roles', roles);
```

### 2.5 VerifiedSeller Decorator
**File**: `src/auth/decorators/verified-seller.decorator.ts`

- Check actor.roles includes SELLER
- Check actor.sellerProfile.status === 'VERIFIED'
- Check actor.sellerProfile.isKycVerified === true

**Deliverable**: Guards + decorators ready to use in resolvers
**Effort**: ~1-2 days

---

## Phase 3: Convert ProductsResolver (2-3 days)

### 3.1 Create ProductsResolver
**File**: `src/products/products.resolver.ts` (replaces controller)

```typescript
@Resolver(() => Product)
export class ProductsResolver {
  constructor(private productsService: ProductsService) {}

  @Query(() => [Product])
  async products(
    @CurrentActor() actor: AuthActor | null,
  ) {
    return this.productsService.findAll(actor);
  }

  @Query(() => Product)
  async product(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor | null,
  ) {
    return this.productsService.findById(id, actor);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Product)
  async createProduct(
    @Args('input') input: CreateProductInput,
    @CurrentActor() actor: AuthActor,
  ) {
    this.authContextService.ensureVerifiedSeller(actor);
    return this.productsService.create(actor, input);
  }

  // ... other mutations
}
```

### 3.2 ProductType GraphQL ObjectType
**File**: `src/products/graphql/product.type.ts`

```typescript
import { ObjectType, Field, ID, Enum } from '@nestjs/graphql';

@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  sellerId: string;

  @Field()
  name: string;

  @Field()
  price: number;

  @Field()
  slug: string;

  @Field(() => ProductStatusEnum)
  status: string;

  @Field(() => String, { nullable: true })
  categoryId?: string;

  @Field(() => [String])
  tags: string[];

  @Field()
  attributes: Record<string, any>;
}

@Enum()
export enum ProductStatusEnum {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED',
}
```

### 3.3 Input Types
**File**: `src/products/graphql/product.input.ts`

```typescript
@InputType()
export class CreateProductInput {
  @Field()
  name: string;

  @Field()
  price: number;

  @Field({ nullable: true })
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}
```

### 3.4 Update ProductsModule
- Remove controller import
- Add resolver import
- Keep service as is

**Deliverable**: Full resolver set for all queries/mutations
**Effort**: ~1-2 days

---

## Phase 4: Integration Testing (1-2 days)

### 4.1 Test Queries
```graphql
query {
  products {
    id
    name
    status
  }
}

query {
  product(id: "p1") {
    id
    name
    sellerId
  }
}
```

### 4.2 Test Mutations (with auth)
```graphql
mutation {
  createProduct(input: { name: "Test", price: 100 }) {
    id
    status
  }
}
```

### 4.3 Test Auth Failures
- Missing token → 401
- Invalid token → 401
- Seller not verified → 403
- Admin action as buyer → 403

### 4.4 Update Seed Scripts
- Mình sẽ ghi rõ: dùng Postman GraphQL tab hoặc `curl` để test

**Deliverable**: All endpoints tested via GraphQL playground
**Effort**: ~0.5-1 day

---

## Phase 5: Documentation + Postman (0.5 days)

### 5.1 Update product-subgraph README
- Remove REST endpoints doc
- Add GraphQL endpoint + playground URL
- Add example queries/mutations

### 5.2 Export GraphQL Schema
```bash
pnpm -C services/product-subgraph custom-script-to-export-schema
# Output: schema.graphql
```

### 5.3 Import vào Postman
- Postman có thể import GraphQL schema trực tiếp
- Hoặc dùng Postman GraphQL query builder

---

## File Structure After Conversion

```
services/product-subgraph/src/
├── main.ts (unchanged)
├── app.module.ts (+ GraphQL)
├── configuration.ts (unchanged)
├── auth/
│   ├── auth-context.service.ts (unchanged)
│   ├── auth-actor.type.ts (unchanged)
│   ├── gql-auth.guard.ts ⭐ NEW
│   ├── roles.guard.ts ⭐ NEW
│   └── decorators/
│       ├── current-actor.decorator.ts ⭐ NEW
│       ├── requires-roles.decorator.ts ⭐ NEW
│       └── requires-verified-seller.decorator.ts ⭐ NEW
├── config/ (unchanged)
├── products/
│   ├── products.module.ts (update: resolver instead of controller)
│   ├── products.resolver.ts ⭐ NEW (replaces controller)
│   ├── products.service.ts (unchanged)
│   ├── product.schema.ts (unchanged - Mongoose)
│   ├── graphql/
│   │   ├── product.type.ts ⭐ NEW (GraphQL ObjectType)
│   │   ├── product.input.ts ⭐ NEW (GraphQL InputType)
│   │   └── product-status.enum.ts ⭐ NEW
│   └── dto/ (can keep or migrate to GraphQL InputTypes)
```

---

## Task Breakdown (Kanban)

| Phase | Task | Days | Blocker | Owner |
|-------|------|------|---------|-------|
| 1 | Setup GraphQL + Apollo | 1-2 | - | Product |
| 1 | Define GraphQL types/schema | 1 | Phase 1 | Product |
| 2 | GqlAuthGuard | 0.5 | Phase 1 | Auth |
| 2 | GqlRolesGuard + Decorators | 1 | GqlAuthGuard | Auth |
| 3 | ProductsResolver (queries) | 1 | Phase 2 | Product |
| 3 | ProductsResolver (mutations) | 1 | Phase 3a | Product |
| 4 | Integration test queries | 0.5 | Phase 3 | Test |
| 4 | Integration test mutations + auth | 0.5 | Phase 4a | Test |
| 5 | Documentation + schema export | 0.5 | Phase 4 | Docs |

**Total**: ~7-9 days (concentrated work) or 2-3 weeks (part-time)

---

## Key Decision Points

### A) Schema File vs Code-First?
- **Code-First** (recommended): 
  - Define ObjectType/InputType in TS → auto-generate schema
  - Pro: Type safe, DRY, easier to refactor
  - Con: Less control over schema structure
  
- **Schema-First**:
  - Write `.graphql` files → generate TS types
  - Pro: Schema visibility, can discuss with frontend first
  - Con: Need sync TS types with schema

**Decision**: Code-First (with @nestjs/graphql)

### B) Single Resolver vs Module Per Types?
- **Single ProductsResolver** (recommended for now)
  - Pro: All product logic in one place
  - Con: File gets large
  
- **Multiple Resolvers** (future):
  - ProductsQueryResolver, ProductsMutationResolver, etc
  - Pro: Separation of concerns
  - Con: Complexity for small schema

**Decision**: Single resolver until >50 fields

### C) DataLoader for N+1?
- Not needed now (single collection, simple queries)
- Add later if queries get complex

---

## Rollback Plan

If GraphQL causes issues:
1. Keep `products.controller.ts` alongside resolver temporarily
2. Switch router to controller via env flag
3. Gradually migrate clients

---

## Success Criteria

✅ GraphQL playground working  
✅ All queries/mutations resolved  
✅ Auth guard + roles working  
✅ Seller verification enforced  
✅ Admin actions restricted  
✅ Token refresh flow working  
✅ Schema introspection working  

---

## Future (Not in Scope)

- [ ] Subscription (WebSocket)
- [ ] Federation / Apollo Gateway
- [ ] Caching / DataLoader
- [ ] Custom scalar types (DateTime, etc)
- [ ] File uploads via GraphQL
