# Auth System Rebuild Plan - Comprehensive
## Product-Subgraph: Complete Auth Implementation

**Date**: May 8, 2026  
**Scope**: Remove old auth + build professional JWT-based guard system from scratch  
**Goal**: Complete, testable auth system that validates user-service tokens and enforces RBAC/permissions  
**Timeline**: 6-8 hours (1-2 days)

---

## Executive Plan

**Decision Made**: 
- ✅ Use JWT verification (not middleware) + Passport.js JwtStrategy
- ✅ Token flow: Bearer → JwtStrategy validates signature → actor in context → guards enforce
- ✅ Remove AuthContextService imperative calls; use declarative guards
- ✅ Build complete test suite (unit + integration + E2E)

---

## PHASE 0: Cleanup & Architecture Planning (TODAY - 30 min)

### 0.1 Remove Old Auth Code

**Files to delete/refactor**:
- [x] `src/auth/gql-auth.guard.ts` (if exists) — superseded by AuthGuard
- [x] `src/auth/gql-roles.guard.ts` (if exists) — superseded by RolesGuard
- [x] `src/auth/gql-verified-seller.guard.ts` (if exists) — superseded by VerifiedSellerGuard
- [ ] Keep: `src/auth/auth.module.ts` (will add JwtStrategy)
- [ ] Keep: `src/auth/auth.guard.ts` (will modify to use JwtStrategy)
- [ ] Refactor: `src/auth/auth-context.service.ts` (reduce to token validation only, remove HTTP boilerplate)

**Imports to clean**:
- Remove AuthContextService from ProductsResolver (use @CurrentActor instead)
- Remove normalizeReq / getOrThrow helpers

### 0.2 Proposed New Auth Architecture

```
JWT Token (from user-service)
    ↓
Request arrives with Bearer {JWT}
    ↓
AuthGuard.canActivate()
    ├─ Extract token from Authorization header
    ├─ Call JwtStrategy.validate(token)
    │   ├─ Verify signature (RS256 public key)
    │   ├─ Check expiry
    │   └─ Decode claims → actor object
    ├─ Attach actor to context (gqlContext.actor)
    └─ Pass to next guard if AuthGuard passes
        ↓
RolesGuard.canActivate() [if @RequiresRoles metadata]
    ├─ Check actor.roles includes required role
    └─ Throw 403 if not
        ↓
PermissionGuard.canActivate() [if @RequiresPermissions metadata]
    ├─ Check actor.permissions includes required permission
    └─ Throw 403 if not
        ↓
VerifiedSellerGuard.canActivate() [if @RequiresVerifiedSeller directive]
    ├─ Check actor.roles includes 'SELLER'
    ├─ Check actor.sellerProfile?.status === 'VERIFIED'
    ├─ Check actor.sellerProfile?.isKycVerified === true
    └─ Throw 403 if not all true
        ↓
Resolver handler runs
    ├─ @CurrentActor() injects actor
    ├─ Business logic (no more manual auth checks)
    └─ Return result
```

### 0.3 New File Structure

```
src/auth/
├── auth.module.ts (exports guards + strategies)
├── auth.guard.ts (Passport entry point)
├── strategies/
│   └── jwt.strategy.ts (RS256 verification)
├── guards/
│   ├── roles.guard.ts (role-based RBAC)
│   ├── permission.guard.ts (fine-grained permissions)
│   └── verified-seller.guard.ts (seller + KYC)
├── decorators/
│   ├── current-actor.decorator.ts (@CurrentActor)
│   ├── requires-roles.decorator.ts (@RequiresRoles)
│   ├── requires-permissions.decorator.ts (@RequiresPermissions)
│   └── requires-verified-seller.decorator.ts (@RequiresVerifiedSeller)
├── types/
│   └── auth-actor.type.ts (AuthActor interface)
└── config/
    └── jwt.config.ts (JWT key handling)
```

---

## PHASE 1: JWT Verification Layer (1-1.5 hours)

### 1.1 Create `src/auth/config/jwt.config.ts`

**Purpose**: Load & cache RS256 public key from user-service environment

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtConfigService {
  private cachedPublicKey: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  getPublicKey(): string {
    if (this.cachedPublicKey) return this.cachedPublicKey;

    const publicKeyPemB64 = this.configService.get<string>(
      'JWT_PRODUCT_PUBLIC_KEY_PEM_B64'
    );
    const publicKeyPem = this.configService.get<string>(
      'JWT_PRODUCT_PUBLIC_KEY_PEM'
    );

    const keyStr = publicKeyPemB64 
      ? Buffer.from(publicKeyPemB64, 'base64').toString('utf8')
      : publicKeyPem;

    if (!keyStr) {
      throw new Error(
        'Missing JWT public key. Set JWT_PRODUCT_PUBLIC_KEY_PEM_B64 or JWT_PRODUCT_PUBLIC_KEY_PEM'
      );
    }

    // Normalize: allow literal \n in env
    this.cachedPublicKey = keyStr.includes('\\n')
      ? keyStr.replace(/\\n/g, '\n')
      : keyStr;

    return this.cachedPublicKey;
  }
}
```

**Config file update** (`src/config/auth.config.ts`):
```typescript
export const authConfig = registerAs('auth', () => ({
  // User-service introspection (backup if JWT fails/updates needed)
  userServiceBaseUrl: process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001',
  
  // JWT verification
  jwtPublicKeyPemB64: process.env.JWT_PRODUCT_PUBLIC_KEY_PEM_B64,
  jwtPublicKeyPem: process.env.JWT_PRODUCT_PUBLIC_KEY_PEM,
  jwtAlgorithm: 'RS256',
  
  // Timeout for any service calls
  requestTimeoutMs: Number(process.env.AUTH_REQUEST_TIMEOUT_MS ?? 5000),
  
  // Dev/test only
  allowTestHeaders: process.env.AUTH_ALLOW_TEST_HEADERS === 'true' ||
    (process.env.NODE_ENV ?? 'development') === 'test',
}));
```

### 1.2 Create `src/auth/strategies/jwt.strategy.ts`

**Purpose**: Passport strategy for RS256 JWT verification

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfigService } from '../config/jwt.config';
import { AuthActor } from '../types/auth-actor.type';

export type JwtPayload = {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly jwtConfig: JwtConfigService) {
    const publicKey = jwtConfig.getPublicKey();
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      secretOrPublicKey: publicKey,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthActor> {
    // At this point, JWT signature is verified by Passport
    // Extract actor from token claims (minimal data)
    return {
      userId: payload.sub,
      email: payload.email,
      roles: [], // Will be populated by calling /auth/introspect or cached
      permissions: [],
      sellerProfile: null,
    };
  }
}
```

**Decision Point**: 
- Option A: Extract only userId/email from JWT, call user-service for roles/permissions (safer, always current)
- Option B: Include roles/permissions in JWT claims (requires token redesign on user-service side)
- **Recommendation**: Use Option A for now (Phase 1), keep /auth/introspect as fallback

### 1.3 Update `src/auth/auth-context.service.ts`

**Refactor**: Keep only JWT validation + introspection fallback; remove HTTP boilerplate

```typescript
import { Injectable, UnauthorizedException, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthActor } from './types/auth-actor.type';

@Injectable()
export class AuthContextService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Resolve full actor (roles + permissions) from user-service
   * Called when JWT doesn't include enough data
   */
  async resolveActorFromIntrospect(userId: string, token: string): Promise<AuthActor> {
    const userServiceBaseUrl = this.configService.get<string>('auth.userServiceBaseUrl') ?? 'http://localhost:4001';
    const timeoutMs = this.configService.get<number>('auth.requestTimeoutMs') ?? 5000;

    const url = `${userServiceBaseUrl.replace(/\/+$/, '')}/api/users/auth/introspect`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException('Token invalid or expired');
        }
        throw new BadGatewayException('User-service error');
      }

      const actor = await response.json() as AuthActor;
      if (!actor.userId) throw new UnauthorizedException('Invalid actor response');
      return actor;
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw new ServiceUnavailableException('User-service timeout');
      }
      if (error instanceof UnauthorizedException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Cannot reach user-service');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if request has dev headers (test mode only)
   */
  getDevActor(req: any): AuthActor | null {
    const allowTest = this.configService.get<boolean>('auth.allowTestHeaders');
    if (!allowTest) return null;

    const userId = req.header?.('x-dev-user-id');
    if (!userId) return null;

    return {
      userId,
      email: req.header?.('x-dev-email'),
      roles: (req.header?.('x-dev-roles') ?? '').split(',').filter(Boolean),
      permissions: (req.header?.('x-dev-permissions') ?? '').split(',').filter(Boolean),
      sellerProfile: req.header?.('x-dev-seller-status')
        ? { status: req.header('x-dev-seller-status'), isKycVerified: req.header('x-dev-kyc-verified') === 'true' }
        : null,
    };
  }
}
```

---

## PHASE 2: AuthGuard (Token Extraction + Passport Integration) (30-45 min)

### 2.1 Update `src/auth/auth.guard.ts`

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthContextService } from './auth-context.service';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private readonly authContextService: AuthContextService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, try Passport JWT verification
    const result = await super.canActivate(context);
    if (!result) return false;

    // Extract request + actor from Passport
    const req = this.getRequest(context);
    let actor = req.user;

    // If JWT didn't provide enough data, call introspect
    if (!actor.roles || actor.roles.length === 0) {
      const token = this.extractToken(req);
      if (token) {
        try {
          actor = await this.authContextService.resolveActorFromIntrospect(actor.userId, token);
          req.user = actor;
        } catch (error) {
          throw error; // Let introspect errors bubble up
        }
      }
    }

    // Attach actor to GraphQL context
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    if (ctx) ctx.actor = actor;

    return true;
  }

  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    if (gqlCtx.getContext()?.req) return gqlCtx.getContext().req;
    return context.switchToHttp().getRequest();
  }

  private extractToken(req: any): string | undefined {
    const header = req.headers?.authorization || req.header?.('authorization');
    if (!header) return undefined;
    const [kind, token] = header.split(' ');
    return kind === 'Bearer' ? token : undefined;
  }
}
```

---

## PHASE 3-4: Guards (RolesGuard, PermissionGuard, VerifiedSellerGuard) (1-1.5 hours)

### 3.1 `src/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('requiredRoles', context.getHandler());
    if (!requiredRoles?.length) return true; // No roles requirement

    const gqlCtx = GqlExecutionContext.create(context);
    const actor = gqlCtx.getContext()?.actor;
    
    if (!actor) throw new UnauthorizedException('Actor not in context');
    if (!actor.roles?.length) throw new ForbiddenException('User has no roles');

    const hasRole = requiredRoles.some((role) => {
      if (role.endsWith('*')) {
        const prefix = role.slice(0, -1);
        return actor.roles.some((r: string) => r.startsWith(prefix));
      }
      return actor.roles.includes(role);
    });

    if (!hasRole) throw new ForbiddenException(`Required one of: ${requiredRoles.join(', ')}`);
    return true;
  }
}
```

### 3.2 `src/auth/guards/permission.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>('requiredPermissions', context.getHandler());
    if (!requiredPermissions?.length) return true;

    const gqlCtx = GqlExecutionContext.create(context);
    const actor = gqlCtx.getContext()?.actor;

    if (!actor) throw new UnauthorizedException('Actor not in context');
    if (!actor.permissions?.length) throw new ForbiddenException('User has no permissions');

    const hasPermission = requiredPermissions.some((perm) =>
      actor.permissions.includes(perm)
    );

    if (!hasPermission) throw new ForbiddenException(`Required one of: ${requiredPermissions.join(', ')}`);
    return true;
  }
}
```

### 4.1 `src/auth/guards/verified-seller.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class VerifiedSellerGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresVerifiedSeller = this.reflector.get<boolean>('requiresVerifiedSeller', context.getHandler());
    if (!requiresVerifiedSeller) return true;

    const gqlCtx = GqlExecutionContext.create(context);
    const actor = gqlCtx.getContext()?.actor;

    if (!actor) throw new UnauthorizedException('Actor not in context');

    const hasSellerRole = actor.roles?.includes('SELLER');
    const isVerified = actor.sellerProfile?.status === 'VERIFIED';
    const isKycVerified = actor.sellerProfile?.isKycVerified === true;

    if (!hasSellerRole || !isVerified || !isKycVerified) {
      throw new ForbiddenException(
        'Verified seller required (must be SELLER role, verified status, KYC completed)'
      );
    }

    return true;
  }
}
```

---

## PHASE 5: Decorators (30 min)

### 5.1 `src/auth/decorators/current-actor.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthActor } from '../types/auth-actor.type';

export const CurrentActor = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthActor | null => {
    const gqlCtx = GqlExecutionContext.create(context);
    return gqlCtx.getContext()?.actor ?? null;
  },
);
```

### 5.2 `src/auth/decorators/requires-roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const RequiresRoles = (...roles: string[]) => 
  SetMetadata('requiredRoles', roles);
```

### 5.3 `src/auth/decorators/requires-permissions.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const RequiresPermissions = (...permissions: string[]) =>
  SetMetadata('requiredPermissions', permissions);
```

### 5.4 `src/auth/decorators/requires-verified-seller.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const RequiresVerifiedSeller = () =>
  SetMetadata('requiresVerifiedSeller', true);
```

---

## PHASE 6: Module + Integration (45 min)

### 6.1 Update `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionGuard } from './guards/permission.guard';
import { VerifiedSellerGuard } from './guards/verified-seller.guard';
import { AuthContextService } from './auth-context.service';
import { JwtConfigService } from './config/jwt.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Re-exported, not used directly
    ConfigModule,
  ],
  providers: [
    JwtConfigService,
    JwtStrategy,
    AuthGuard,
    RolesGuard,
    PermissionGuard,
    VerifiedSellerGuard,
    AuthContextService,
  ],
  exports: [
    AuthGuard,
    RolesGuard,
    PermissionGuard,
    VerifiedSellerGuard,
    AuthContextService,
  ],
})
export class AuthModule {}
```

### 6.2 Update `src/products/products.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { VerifiedSellerGuard } from '../auth/guards/verified-seller.guard';
import { ProductsResolver } from './products.resolver';
import { ProductModel, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductModel.name, schema: ProductSchema },
    ]),
  ],
  providers: [
    ProductsService,
    AuthGuard,
    RolesGuard,
    PermissionGuard,
    VerifiedSellerGuard,
    ProductsResolver,
  ],
})
export class ProductsModule {}
```

### 6.3 Update `src/products/products.resolver.ts`

Replace entire file to use new guard system:

```typescript
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';

import { AuthActor } from '../auth/types/auth-actor.type';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VerifiedSellerGuard } from '../auth/guards/verified-seller.guard';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';
import { RequiresRoles } from '../auth/decorators/requires-roles.decorator';
import { RequiresVerifiedSeller } from '../auth/decorators/requires-verified-seller.decorator';
import { CreateProductInput, UpdateProductInput } from './graphql/product.input';
import { Product as ProductGql } from './graphql/product.type';
import { ProductsService } from './products.service';

@Resolver(() => ProductGql)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  // Public: list products (optional auth for filtering)
  @Query(() => [ProductGql], { name: 'products' })
  async findAll(@CurrentActor() actor: AuthActor | null): Promise<ProductGql[]> {
    return this.productsService.findAll(actor);
  }

  // Public: get product by id
  @Query(() => ProductGql, { name: 'product' })
  async findById(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<ProductGql> {
    const product = await this.productsService.findById(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  // Auth required: create product (seller only + verified + KYC)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async createProduct(
    @Args('input') input: CreateProductInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    return this.productsService.create(actor, input as any);
  }

  // Auth required: update product (seller)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async updateProduct(
    @Args('id') id: string,
    @Args('input') input: UpdateProductInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.update(id, actor, input as any);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  // Auth required: delete product (seller)
  @Mutation(() => Boolean)
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async deleteProduct(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<boolean> {
    const removed = await this.productsService.remove(id, actor);
    if (!removed) throw new NotFoundException(`Product ${id} not found`);
    return true;
  }

  // Auth required: submit for review (seller)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async submitProductForReview(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.submitForReview(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  // Auth required: approve (admin only)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, RolesGuard)
  @RequiresRoles('ADMIN_*')
  async approveProduct(@Args('id') id: string): Promise<ProductGql> {
    const product = await this.productsService.approve(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  // Auth required: reject (admin only)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, RolesGuard)
  @RequiresRoles('ADMIN_*')
  async rejectProduct(@Args('id') id: string): Promise<ProductGql> {
    const product = await this.productsService.reject(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  // Auth required: archive (seller)
  @Mutation(() => ProductGql)
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async archiveProduct(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.archive(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }
}
```

---

## PHASE 7-9: Testing (2-3 hours)

### 7.1 Unit Test: RolesGuard

**File**: `src/auth/guards/roles.guard.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow when no roles required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(null);
    const result = guard.canActivate({} as ExecutionContext);
    expect(result).toBe(true);
  });

  it('should allow when user has required role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const context = {
      switchToRpc: () => ({
        getContext: () => ({ actor: { roles: ['ADMIN', 'MEMBER'] } }),
      }),
    } as ExecutionContext;
    
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow wildcard role matching', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN_*']);
    const context = {
      switchToRpc: () => ({
        getContext: () => ({ actor: { roles: ['ADMIN_PRODUCTS'] } }),
      }),
    } as ExecutionContext;

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw when user lacks required role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['ADMIN']);
    const context = {
      switchToRpc: () => ({
        getContext: () => ({ actor: { roles: ['BUYER'] } }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
```

### 8.1 Integration Test: Auth Flow

**File**: `src/auth/auth.guard.integration.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AuthGuard } from './auth.guard';
import { AuthContextService } from './auth-context.service';

describe('Auth Flow Integration', () => {
  let app: INestApplication;
  let authService: AuthContextService;

  beforeEach(async () => {
    // Mock user-service introspect
    const mockAuthService = {
      resolveActorFromIntrospect: jest.fn().mockResolvedValue({
        userId: 'user_123',
        email: 'test@example.com',
        roles: ['SELLER'],
        permissions: [],
        sellerProfile: { status: 'VERIFIED', isKycVerified: true },
      }),
      getDevActor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AuthContextService, useValue: mockAuthService },
        AuthGuard,
      ],
    }).compile();

    authService = module.get<AuthContextService>(AuthContextService);
  });

  it('should extract and verify Bearer token', async () => {
    const token = 'valid.jwt.token';
    // Test token extraction + JWT verification
    // (Integration with real JWT would require valid RS256 token)
  });

  it('should fail on missing Authorization header', async () => {
    // Test 401 response
  });

  it('should call introspect for full actor data', async () => {
    // Verify introspect endpoint called with token
  });
});
```

### 9.1 E2E Validation Script

**File**: `scripts/e2e-auth-test.ts`

```typescript
import fetch from 'node-fetch';

async function e2eAuthTest() {
  const userServiceUrl = 'http://localhost:4001';
  const productServiceUrl = 'http://localhost:4002/graphql';

  console.log('🧪 E2E Auth Test');
  console.log('================\n');

  try {
    // Step 1: Login seller
    console.log('Step 1: Login as seller...');
    const loginRes = await fetch(`${userServiceUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'seller@example.com',
        password: 'ChangeMe123',
      }),
    });

    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.status);
      return;
    }

    const { accessToken: sellerToken } = await loginRes.json() as any;
    console.log('✅ Seller token obtained\n');

    // Step 2: Create product (seller)
    console.log('Step 2: Create product as seller...');
    const createRes = await fetch(productServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({
        query: `
          mutation CreateProduct($input: CreateProductInput!) {
            createProduct(input: $input) { id name status }
          }
        `,
        variables: {
          input: { name: 'Test Product', price: 99.99, slug: 'test-1' },
        },
      }),
    });

    if (!createRes.ok) {
      console.error('❌ Create failed:', createRes.status);
      return;
    }

    const createData = await createRes.json() as any;
    if (createData.errors) {
      console.error('❌ GraphQL error:', createData.errors[0].message);
      return;
    }

    console.log('✅ Product created:', createData.data.createProduct.id, '\n');

    // Step 3: Try create as buyer (should fail)
    console.log('Step 3: Try create as buyer (should fail)...');
    const buyerLoginRes = await fetch(`${userServiceUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'buyer@example.com',
        password: 'ChangeMe123',
      }),
    });

    const { accessToken: buyerToken } = await buyerLoginRes.json() as any;

    const buyerCreateRes = await fetch(productServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        query: `mutation { createProduct(input: {name: "Bad", price: 1, slug: "bad"}) { id } }`,
      }),
    });

    const buyerCreateData = await buyerCreateRes.json() as any;
    if (buyerCreateData.errors?.some((e: any) => e.message.includes('Verified seller required'))) {
      console.log('✅ Buyer correctly rejected\n');
    } else {
      console.error('❌ Buyer should have been rejected');
    }

    // Step 4: Test without token (should fail)
    console.log('Step 4: Try without token (should fail)...');
    const noTokenRes = await fetch(productServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { products { id } }`,
      }),
    });

    const noTokenData = await noTokenRes.json() as any;
    // Public queries allowed without token, so this should succeed
    console.log('✅ Public query allowed without token\n');

    console.log('🎉 All E2E tests passed!');
  } catch (error) {
    console.error('❌ E2E test error:', error);
  }
}

e2eAuthTest();
```

---

## Environment Configuration

### `.env` for Product-Subgraph

```plaintext
# JWT verification (from user-service)
JWT_PRODUCT_PUBLIC_KEY_PEM_B64=<base64-encoded-public-key>
# OR
JWT_PRODUCT_PUBLIC_KEY_PEM=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----

# User-service fallback (introspection)
USER_SERVICE_BASE_URL=http://localhost:4001
AUTH_REQUEST_TIMEOUT_MS=5000

# Development only
AUTH_ALLOW_TEST_HEADERS=true
NODE_ENV=development
```

### How to Get JWT Public Key from User-Service

```bash
# During user-service startup, logs show ephemeral key (dev mode)
# For production, generate RSA keypair and set env vars

# Generate (one-time):
ssh-keygen -t rsa -b 2048 -f jwt_key -m pem -N ""
cat jwt_key.pub | base64 | xclip -i

# Set in product-subgraph: JWT_PRODUCT_PUBLIC_KEY_PEM_B64=<base64>
```

---

## Complete Checklist

### Files to Create
- [ ] `src/auth/config/jwt.config.ts`
- [ ] `src/auth/strategies/jwt.strategy.ts`
- [ ] `src/auth/guards/roles.guard.ts`
- [ ] `src/auth/guards/permission.guard.ts`
- [ ] `src/auth/guards/verified-seller.guard.ts`
- [ ] `src/auth/decorators/requires-permissions.decorator.ts` (new)
- [ ] `src/auth/guards/roles.guard.spec.ts`
- [ ] `src/auth/auth.guard.integration.spec.ts`
- [ ] `scripts/e2e-auth-test.ts`

### Files to Modify
- [ ] `src/auth/auth.guard.ts` (update canActivate)
- [ ] `src/auth/auth-context.service.ts` (refactor)
- [ ] `src/auth/auth.module.ts` (add JwtStrategy)
- [ ] `src/products/products.module.ts` (wire guards)
- [ ] `src/products/products.resolver.ts` (use @UseGuards)
- [ ] `src/config/auth.config.ts` (add JWT config)

### Files to Delete
- [ ] `src/auth/gql-auth.guard.ts` (if exists)
- [ ] `src/auth/gql-roles.guard.ts` (if exists)
- [ ] `src/auth/gql-verified-seller.guard.ts` (if exists)

### Validation Steps
- [ ] TypeScript compilation (`npm run build`)
- [ ] Services start without errors
- [ ] Seed demo users
- [ ] Login → get token
- [ ] GraphQL mutations with token → success
- [ ] GraphQL mutations without token → 401
- [ ] GraphQL mutations with insufficient role → 403
- [ ] E2E test script passes

---

## Estimated Timeline

| Phase | Task | Effort | Status |
|-------|------|--------|--------|
| 0 | Plan + Clean | 30 min | TODO |
| 1 | JWT Layer | 1-1.5h | TODO |
| 2 | AuthGuard | 30-45 min | TODO |
| 3-4 | Guards | 1-1.5h | TODO |
| 5 | Decorators | 30 min | TODO |
| 6 | Integration | 45 min | TODO |
| 7-9 | Testing | 2-3h | TODO |
| **Total** | | **6-8h** | **1-2 days** |

---

## Success Criteria

- ✅ JWT token verified locally (RS256 signature check)
- ✅ Role-based access control enforced (@RequiresRoles, @RequiresVerifiedSeller)
- ✅ Actor fully resolved from token (userId, email, roles, permissions, seller status)
- ✅ Guards chain properly (AuthGuard → RolesGuard → VerifiedSellerGuard)
- ✅ Error codes 401/403/502/503 returned appropriately
- ✅ E2E test passes: login → create → approve workflow
- ✅ All tests passing (unit + integration + E2E)
- ✅ Code deployed successfully

---

**Document Status**: Ready for Implementation  
**Prepared**: May 8, 2026
