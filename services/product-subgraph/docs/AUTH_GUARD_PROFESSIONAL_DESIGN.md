# Auth Guard Professional Design Plan  
## Product-Subgraph Service Authentication  

**Date**: May 8, 2026  
**Scope**: Microservice authentication for GraphQL + REST  
**Goal**: Implement professional, production-ready auth guards for learning project (MVP + future hardening)

---

## 1. Executive Summary

This document outlines a professional auth guard design for `product-subgraph`, built on user-service auth contract. The approach is **Progressive**: launch MVP now (introspection via Passport strategy), then add caching/circuit-breaker in Phase 2.

**Key Principles**:
- ✅ **Explicit security contracts** (decorators + guards = self-documenting)
- ✅ **Minimal data exposure** (introspection endpoint vs full profile)
- ✅ **Error handling parity** with user-service (401/403/502/503)
- ✅ **Composable guards** (AuthGuard → RolesGuard → VerifiedSellerGuard)
- ✅ **Testable design** (mock guards independently)
- ✅ **Performance-ready** (caching protocol defined, optional Phase 2)

---

## 2. Auth Contract (User-Service)

### 2.1 Token Format & Lifecycle

**Access Token (JWT)**:
- **Algorithm**: RS256 (asymmetric, public key verification)
- **Payload**: `{ sub: userId, email: user.email }`
- **TTL**: 15 minutes (default, configurable via `JWT_ACCESS_TTL`)
- **Verification**: Public key in user-service, shared to product-subgraph
- **Revocation**: Client-side only (no server-side revocation list)

**Refresh Token (Opaque)**:
- **Format**: `{tokenId}.{secret}` (separated by dot)
- **Storage**: Hashed in user-service DB (server-side pepper)
- **TTL**: 7 days (default, configurable via `JWT_REFRESH_TTL`)
- **Rotation**: Single-use, replaced on each refresh
- **Revocation**: Immediate (server can revoke sessions)
- **Scope**: NOT used by product-subgraph (client-side concern)

### 2.2 Actor Contract (Introspection Response)

**Minimal Service Contract** (`POST /api/users/auth/introspect`):

```json
{
  "userId": "user_abc123",
  "email": "seller@example.com",
  "roles": ["SELLER", "MEMBER"],
  "permissions": ["product.create", "product.update"],
  "sellerProfile": {
    "status": "VERIFIED",
    "isKycVerified": true,
    "shopName": "My Shop"
  },
  "exp": 1705000000,
  "_comment": "exp is Unix timestamp (seconds) from JWT decode"
}
```

**Null Seller Profile**: If user is not a seller, `sellerProfile: null`.

### 2.3 Error Codes & Mappings

| Condition | HTTP | Code | Message | Retry? |
|-----------|------|------|---------|--------|
| No Authorization header | 401 | AUTH_UNAUTHORIZED | "Missing Authorization header" | No |
| Bearer token malformed | 401 | AUTH_TOKEN_INVALID | "Access token invalid" | No |
| Token expired | 401 | AUTH_TOKEN_EXPIRED | "Access token expired" | Yes (refresh) |
| Token signature invalid | 401 | AUTH_TOKEN_INVALID | "Access token invalid" | No |
| User-service unreachable | 502 | SERVICE_UNAVAILABLE | "Cannot reach user-service" | Yes |
| User-service timeout | 503 | SERVICE_UNAVAILABLE | "User-service request timed out" | Yes |
| User deleted (but token valid) | 401 | AUTH_TOKEN_INVALID | "Cannot resolve user identity" | No |
| Bad response from introspect | 502 | SERVICE_UNAVAILABLE | "Invalid response from user-service" | Yes |

**GraphQL Error Format**:
```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "originalError": {
          "statusCode": 401,
          "message": "Access token invalid or expired",
          "code": "AUTH_TOKEN_INVALID"
        }
      }
    }
  ]
}
```

### 2.4 RS256 Keys Configuration

**User-Service** loads keys from:
1. `JWT_ACCESS_PRIVATE_KEY_PEM_B64` (recommended, base64-encoded)
2. `JWT_ACCESS_PRIVATE_KEY_PEM` (fallback, literal PEM)
3. Dev ephemeral (generated if missing + NODE_ENV=development)

**Product-Subgraph** should:
- **NOT** verify token locally (complex key rotation)
- **Delegate** to user-service via `/auth/introspect` POST (introspection pattern)
- **Avoid** storing/caching public keys (extra complexity)

---

## 3. Current Product-Subgraph Auth Architecture

### 3.1 Existing Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `AuthGuard` | Passport entry point + GraphQL context normalization | ✅ Implemented |
| `UserServiceStrategy` | Bearer token → actor resolution via introspect | ✅ Implemented |
| `AuthContextService` | HTTP client to user-service + fallback dev headers | ✅ Implemented |
| `RolesGuard` | Role-based RBAC + wildcard matching | ✅ Implemented |
| `VerifiedSellerGuard` | Seller + KYC verification + status check | ✅ Implemented |
| `@CurrentActor` | Decorator to inject actor into resolver params | ✅ Implemented |
| `@RequiresRoles` | Metadata for role requirements | ✅ Implemented |
| `@RequiresVerifiedSeller` | Metadata for seller verification | ✅ Implemented |
| **auth.config.ts** | Configuration (userServiceBaseUrl, timeouts) | ✅ Implemented |

### 3.2 Execution Flow (Happy Path)

```
GraphQL Mutation (with Bearer token)
    ↓
AuthGuard.canActivate()
    ├─ Extract authorization header
    ├─ Create AbortController (timeout)
    └─ Call UserServiceStrategy.validate(token)
        ├─ Call authContextService.resolveActorFromToken(token)
        ├─ POST /api/users/auth/introspect (user-service)
        ├─ Parse response → AuthActor object
        └─ Return actor to Passport
    ├─ Passport attaches actor to request/context
    ├─ Store in gqlContext.actor
    └─ Pass to next guard
        ↓
RolesGuard.canActivate() [if @RequiresRoles present]
    ├─ Extract metadata: reflector.get('roles', handler)
    ├─ Check actor.roles against required roles
    ├─ Support wildcard: 'ADMIN_*' matches 'ADMIN_PRODUCTS', etc.
    └─ Throw 403 if insufficient
        ↓
VerifiedSellerGuard.canActivate() [if @RequiresVerifiedSeller present]
    ├─ Extract metadata: reflector.get('requiresVerifiedSeller', handler)
    ├─ Check actor.roles.includes('SELLER')
    ├─ Check actor.sellerProfile?.status === 'VERIFIED'
    ├─ Check actor.sellerProfile?.isKycVerified === true
    └─ Throw 403 if not all true
        ↓
Resolver Handler Runs
    ├─ @CurrentActor() decorator injects actor from context
    ├─ Business logic executes (no more auth checks!)
    └─ Return result
        ↓
Response to client
```

### 3.3 Error Flow (Failure Cases)

```
Scenario 1: No token
    ↓ AuthGuard
    ├─ No Authorization header
    └─ Throw UnauthorizedException (401)

Scenario 2: Invalid token
    ↓ AuthGuard
    ├─ Passport strategy calls resolveActorFromToken()
    ├─ /introspect returns 401
    └─ Throw UnauthorizedException (401)

Scenario 3: Role missing
    ↓ AuthGuard ✅
    ↓ RolesGuard
    ├─ Reflector.get('roles', handler) = ['ADMIN_*']
    ├─ Actor.roles = ['BUYER']
    └─ Throw ForbiddenException (403)

Scenario 4: Seller not verified
    ↓ AuthGuard ✅
    ↓ VerifiedSellerGuard
    ├─ Actor.sellerProfile?.status = 'PENDING_VERIFICATION'
    └─ Throw ForbiddenException (403)

Scenario 5: User-service down
    ↓ AuthGuard
    ├─ resolveActorFromToken() network error
    └─ Throw BadGatewayException (502)
```

---

## 4. Professional Auth Guard Design (MVP + Phase 2)

### MVP (Today - MVP Ship Ready)

**Goal**: Ship secure, testable auth with introspection. No fancy caching/circuit-breakers yet.

#### 4.1 MVP Architecture

```typescript
// Types
export type AuthActor = {
  userId: string;
  email?: string;
  roles: string[];
  permissions: string[];
  sellerProfile?: {
    status: string;
    isKycVerified: boolean;
  } | null;
};

// Strategy (passport entry)
export class UserServiceStrategy extends PassportStrategy(BearerStrategy) {
  async validate(token: string): Promise<AuthActor> {
    const actor = await this.authContextService.resolveActorFromToken(token);
    if (!actor) throw new UnauthorizedException('Invalid token');
    return actor;
  }
}

// Guard (handles GraphQL + HTTP context)
@Injectable()
export class AuthGuard extends PassportAuthGuard('user-service') {
  getRequest(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    if (gqlCtx.getContext()?.req) return gqlCtx.getContext().req;
    return context.switchToHttp().getRequest();
  }
}

// Usage in Resolver
@Mutation()
@UseGuards(AuthGuard, VerifiedSellerGuard)
@RequiresVerifiedSeller()
async createProduct(
  @Args('input') input: CreateProductInput,
  @CurrentActor() actor: AuthActor,
): Promise<ProductGql> {
  // actor is guaranteed valid, seller, verified, KYC done
  return this.productsService.create(actor, input);
}
```

#### 4.2 MVP Configuration Requirements

**Environment Variables** (`product-subgraph/.env`):

```plaintext
# User-service connection
USER_SERVICE_BASE_URL=http://localhost:4001
AUTH_REQUEST_TIMEOUT_MS=5000

# Development only: allow x-dev-* headers for testing
AUTH_ALLOW_TEST_HEADERS=true  # false in production
NODE_ENV=development
```

**Configuration File** (`src/config/auth.config.ts` - already implemented):

```typescript
export const authConfig = registerAs('auth', () => ({
  userServiceBaseUrl:
    process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001',
  requestTimeoutMs: Number(process.env.AUTH_REQUEST_TIMEOUT_MS ?? 5000),
  allowTestHeaders:
    process.env.AUTH_ALLOW_TEST_HEADERS === 'true' ||
    (process.env.NODE_ENV ?? 'development') === 'test',
}));
```

#### 4.3 MVP Error Handling

All errors from introspection should map to GraphQL-compatible exceptions:

```typescript
// In AuthContextService.resolveActorFromToken():

// Network error
if (network error) throw new BadGatewayException('Cannot reach user-service');

// Timeout
if (timeout) throw new ServiceUnavailableException('User-service request timed out');

// 401/403 from user-service
if (response.status === 401 || 403) {
  throw new UnauthorizedException('Access token invalid or expired');
}

// 5xx from user-service
if (!response.ok) {
  throw new BadGatewayException('User-service error while resolving identity');
}

// Invalid response
if (!validJson) throw new BadGatewayException('Invalid response from user-service');
```

**Mapped to GraphQL**:
- 401 → Unauthorized error, client should refresh
- 403 → Forbidden error, user needs different role/status
- 502 → Service Unavailable, client should retry
- 503 → Service Unavailable, client should retry with backoff

#### 4.4 MVP Testing Strategy

**Unit Tests** (guards isolated):
- AuthGuard: mocked actor injection
- RolesGuard: wildcard matching, metadata reflection
- VerifiedSellerGuard: seller status validation

**Integration Tests** (with mock user-service):
- Happy path: valid token → actor resolved
- Invalid token → 401
- Role mismatch → 403
- Service unreachable → 502

**E2E Tests** (real user-service):
- Login → get token → create product mutation (GraphQL)
- Separate admin token → approve mutation

#### 4.5 MVP Limitations & Acceptance

**Design Trade-offs**:

| Trade-off | Why | Impact | Mitigation |
|-----------|-----|--------|-----------|
| No local caching | Reduces complexity, network cost acceptable for MVP | ~200-500ms latency per mutation | Monitor; add cache Phase 2 if needed |
| No circuit-breaker | Keep MVP simple | If user-service down, mutations fail fast | Acceptable; user-service HA is priority |
| No token key rotation | Simplify deployment | Old tokens valid until JWT exp | Acceptable; JWT TTL = 15m |
| Network call per request | Simple, always current data | Latency + user-service load | Phase 2: cache + async refresh |

---

## 5. Phase 2: Hardening & Optimization (Post-MVP)

### 5.1 Phase 2 Features (Optional, After MVP Stable)

**Timeline**: Week 2-3 after MVP ships, if monitoring shows need.

#### A. Actor Caching (Redis)

**Strategy**:
- Cache actor in Redis: key = `actor:token:{hash}`, value = actor JSON
- TTL: 60 seconds (aggressive but safe; if seller status changes, reflects in ≤60s)
- Invalidation: On user logout / password change, delete cache key

**Benefit**: -80% latency for repeat requests (first request 300ms, cached 10ms)

```typescript
async resolveActorFromToken(token: string): Promise<AuthActor> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const cacheKey = `actor:${tokenHash}`;
  
  // Check cache first (Redis)
  const cached = await this.redisService.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Cache miss: fetch from user-service
  const actor = await this.fetchActorFromUserService(token);
  
  // Store in cache for 60 seconds
  await this.redisService.set(cacheKey, JSON.stringify(actor), 'EX', 60);
  return actor;
}
```

#### B. Circuit Breaker (Failfast)

**Strategy**:
- If user-service fails 5 times in 30 seconds, open circuit
- Return cached actor if available, else 503
- Half-open after 10 seconds, retry single request

**Benefit**: Faster failure feedback when user-service is down; reduce cascading failures

```typescript
// Using resilience4j or similar library
@CircuitBreaker(
  name: 'userServiceIntrospect',
  failureThreshold: 5,
  delay: 30000,
  halfOpenTimeout: 10000
)
private async fetchActorFromUserService(token: string) {
  // existing implementation
}
```

#### C. Request Batching (Optional)

**Strategy**:
- Collect multiple introspect requests in a batch window (10ms)
- Send single bulk request: `POST /auth/introspect/batch`
- Reduce round-trips if multiple resolvers call auth simultaneously

**Benefit**: Marginal (GraphQL resolvers usually sequential); only if profiling shows contention

#### D. Monitoring & Observability

**Metrics to track**:
- `auth.introspect.duration_ms` (histogram)
- `auth.introspect.cache_hit_rate` (gauge)
- `auth.introspect.failures` (counter, by error type)
- `auth.guard.401_count`, `403_count`, `502_count` (counters)

**Alerts**:
- `introspect.duration_p99 > 1000ms` (latency spike)
- `introspect.failure_rate > 0.05` (>5% failures)
- `circuit_breaker.open` (user-service down)

---

## 6. Security Best Practices

### 6.1 Token Lifecycle

**Issuance** (user-service):
- RS256 private key signs JWT (15m TTL)
- Only user-service can issue tokens

**Transport** (all services):
- Always require HTTPS in production (env var `AUTH_COOKIE_SECURE=true`)
- Bearer token in Authorization header (not URL params, not body)
- HttpOnly cookies for refresh token (browser XSS protection)

**Verification** (product-subgraph):
- Trust user-service introspect response (user-service verifies JWT)
- Do NOT re-verify JWT locally (adds key rotation complexity)
- Accept that token might be slightly stale (max 60s if caching)

**Revocation** (user-service):
- Access tokens: NOT revocable (JWTs), only expire after TTL
- Refresh tokens: revocable immediately (session/logout)
- Seller status changes: immediately visible to all services (via introspect)

### 6.2 RBAC Model

**Roles** (user-service DB):
- SUPER_ADMIN, ADMIN_*, SELLER, MEMBER, BUYER
- Stored in `role` table, joined to user via `user_role`

**Permissions** (user-service DB):
- Fine-grained (e.g., `product.create`, `product.update`, `order.approve`)
- Stored in `permission` table, joined via `role_permission` (role-level) or `user_permission` (direct)

**Product-Subgraph Usage**:
- Query roles for broad checks: `@RequiresRoles('ADMIN_*', 'SELLER')`
- Don't query permissions directly (future refinement)
- Guards enforce; resolvers trust guards

### 6.3 Data Minimization

**Introspect Response** (what we expose):
- Minimal: userId, email, roles[], permissions[], sellerProfile{status, isKycVerified}, exp
- Reason: Service contract, not user-facing; supports caching

**What's NOT exposed**:
- displayName, avatarUrl, bio (use `/auth/me` if user client needs it)
- passwordHash, 2FA settings, audit logs (obviously!)
- sellerProfile.totalProducts, avgRating (cacheable but service-specific)

**Logging & Audit**:
- Log auth failures: unauthorized, role mismatch, service errors
- DO NOT log token values (privacy)
- Log actor in audit trail for data access (GDPR)

---

## 7. Deployment & Operations

### 7.1 Environment Setup Checklist

- [ ] `USER_SERVICE_BASE_URL` correct in product-subgraph `.env`
- [ ] `AUTH_REQUEST_TIMEOUT_MS` tuned for network (default 5000ms)
- [ ] `AUTH_ALLOW_TEST_HEADERS` disabled in production
- [ ] user-service running and healthy (`/health` endpoint available)
- [ ] User-service JWT keys configured (B64 or PEM)
- [ ] Product-subgraph starts without auth errors (logs show successful startup)

### 7.2 Monitoring & Alerting

**Health Checks**:
- Add `/health` endpoint to product-subgraph; include auth service status
- Periodic introspect test call (e.g., every 30s with valid token)

**Key Metrics**:
- p50/p95/p99 introspect latency (should be <300ms normally)
- 4xx/5xx rate from auth guards
- User-service unavailability duration

### 7.3 Rollback Plan

If auth breaks after deploy:

1. Revert product-subgraph code
2. Restart product-subgraph
3. Verify introspect endpoint still reachable
4. If user-service issue: scale/restart user-service pods
5. Clear any caches (Redis) if corruption suspected

---

## 8. Compliance & Learning Goals

### 8.1 Professional Patterns Demonstrated

- ✅ **OAuth2-style introspection** (industry standard)
- ✅ **Passport strategy for service integration** (NestJS pattern)
- ✅ **Guard composition** (clean RBAC)
- ✅ **Minimal data contracts** (service-to-service design)
- ✅ **Error handling parity** (codes map to domain)
- ✅ **Configuration management** (12-factor app)
- ✅ **Circuit-breaker-ready** (resilience pattern prep)

### 8.2 Project Scope Alignment

**MVP Scope** (this week):
- Introspection via Passport strategy ✅
- Guard chain (Auth + Roles + VerifiedSeller) ✅
- Error mapping (401/403/502/503) ✅
- Configuration via env ✅

**Post-MVP Scope** (if time):
- Redis caching (30-60s) ⏳
- Circuit breaker (resilience) ⏳
- Monitoring dashboard ⏳

---

## 9. Recommended Implementation Order

### Week 1 (MVP - TODAY/TOMORROW)

1. ✅ Verify UserServiceStrategy works (Passport + Bearer token)
2. ✅ Verify AuthGuard context normalization (GraphQL + HTTP)
3. ✅ Verify RolesGuard metadata reflection (wildcard matching)
4. ✅ Verify VerifiedSellerGuard seller status checks
5. ✅ Verify decorators (@CurrentActor, @RequiresRoles, @RequiresVerifiedSeller)
6. ✅ Test mutations: create (seller), approve (admin)
7. ✅ Test error scenarios: 401 (no token), 403 (role mismatch), 502 (service down)
8. ✅ Document config requirements
9. ✅ Prepare demo seed script output
10. ✅ **SHIP MVP**

### Week 2 (If Needed - Phase 2)

1. Profile introspect latency (p99 <300ms usually OK)
2. If latency high: add Redis cache (60s TTL)
3. If user-service unreliable: add circuit breaker
4. Add monitoring/alerts to infrastructure
5. Update documentation with metrics

---

## 10. FAQ & Troubleshooting

**Q: Why not verify JWT locally in product-subgraph?**  
A: Adds key rotation complexity; user-service is the source of truth. Introspection is cleaner for microservices.

**Q: What if introspect endpoint is too slow?**  
A: Normal latency ~100-300ms. If sustained >500ms, investigate user-service DB / network. Phase 2: add 60s cache.

**Q: Why 15m JWT TTL?**  
A: Balance between security (refresh often) and UX (not annoying). Standard practice.

**Q: How do I know if role changed for a user?**  
A: Introspect on next request. For real-time: user-service publishes events (future).

**Q: Can I cache the public JWT key locally?**  
A: Not recommended (rotation complexity). Let user-service be the source of truth.

**Q: What happens if seller status changes mid-request?**  
A: Actor is resolved at guard time; status correct for that moment. OK for MVP.

---

## 11. Conclusion

This design provides **production-quality authentication** for a learning project:

- ✅ **MVP ready today**: introspection + guards + error handling
- ✅ **Professional patterns**: OAuth2, Passport, composable guards
- ✅ **Scalable foundation**: caching/circuit-breaker prepared (Phase 2)
- ✅ **Secure by default**: minimal data, error parity, token lifecycle
- ✅ **Testable architecture**: guards isolated, easily mocked

**Next actions**:
1. Review this design with your team/mentor
2. Run MVP test suite (seed users → login → mutations)
3. Deploy product-subgraph with confidence
4. Monitor in production; decide on Phase 2 after 1 week

---

**Document Version**: 1.0  
**Last Updated**: May 8, 2026  
**Status**: Ready for Implementation
