# Auth Introspect Endpoint

## Overview

The `/auth/introspect` endpoint is designed for **service-to-service authentication** verification. Instead of the full user profile from `/auth/me`, this endpoint returns a minimal, cacheable actor contract optimized for distributed authorization.

## Endpoint

```
POST /api/users/auth/introspect
Authorization: Bearer <access_token>
```

## Request

**Headers**:
- `Authorization: Bearer <access_token>` (required)
  - Same RS256 JWT access token used for other authenticated requests
  - Token must be valid and not expired

**Body**: None (empty POST)

## Response

### Success (200 OK)

```json
{
  "userId": "user_abc123",
  "email": "seller@example.com",
  "roles": ["SELLER", "MEMBER"],
  "permissions": ["product.create", "product.update", "product.delete"],
  "sellerProfile": {
    "status": "VERIFIED",
    "isKycVerified": true,
    "shopName": "My Shop"
  },
  "exp": 1705000000
}
```

**Response Fields**:
- `userId` (string): User's unique identifier
- `email` (string): User's email address
- `roles` (string[]): Array of role names (e.g., "SELLER", "ADMIN", "MEMBER")
- `permissions` (string[]): Array of permission names (de-duplicated, from roles + direct)
- `sellerProfile` (object|null): Seller information (null if user is not a seller)
  - `status`: Seller verification status (PENDING_VERIFICATION, VERIFIED, SUSPENDED, BANNED)
  - `isKycVerified`: Whether seller has completed KYC verification (boolean)
  - `shopName`: Shop name
- `exp` (number|null): JWT expiration timestamp (Unix seconds) for cache validation

### Error

**401 Unauthorized**:
- Missing or invalid Bearer token
- Token expired
- User no longer exists

```json
{
  "code": "AUTH_UNAUTHORIZED",
  "message": "Missing Authorization header"
}
```

## Use Cases

### For Product Subgraph (Guards)

```typescript
// In ProductsResolver guards:
const bearerToken = request.headers.authorization?.split(" ")[1];
const actor = await fetch("http://user-service:3000/api/users/auth/introspect", {
  method: "POST",
  headers: { 
    "Authorization": `Bearer ${bearerToken}`,
    "Content-Type": "application/json"
  }
}).then(r => r.json());

// Check roles
if (!actor.roles.includes("SELLER")) {
  throw new ForbiddenException("Only sellers can perform this action");
}

// Check seller verification
if (actor.sellerProfile?.status !== "VERIFIED") {
  throw new ForbiddenException("Seller is not verified");
}
```

### With Caching (30-60s TTL)

```typescript
const tokenHash = crypto.createHash("sha256").update(bearerToken).digest("hex");
const cacheKey = `auth:token:${tokenHash}`;

// Check cache first
let actor = await redis.get(cacheKey);

if (!actor) {
  // Fetch from introspect if not cached
  actor = await fetch("http://user-service:3000/api/users/auth/introspect", {
    method: "POST",
    headers: { "Authorization": `Bearer ${bearerToken}` }
  }).then(r => r.json());
  
  // Cache for 60 seconds (or until exp - 30s)
  await redis.set(cacheKey, JSON.stringify(actor), "EX", 60);
}
```

## Design Rationale

### Why Service-Specific Endpoint?

1. **Clear Boundary**: User API (`/auth/me`) returns full profile for clients. Introspect returns minimal service contract.
2. **Cacheability**: Smaller response = easier to cache in Redis
3. **Performance**: No unnecessary fields (displayName, avatarUrl, bio, etc.)
4. **Security**: Service contract is explicit and auditable

### Why Not Self-Contained JWT?

- Seller status is **dynamic** (can change in DB without new token)
- KYC verification is **database-driven**
- Role changes need **immediate effect** (can't wait for JWT expiry)
- Token TTL (15 minutes) means stale data if embedded

## Migration Path

### Phase 1 (This Week)
- Product-subgraph uses `/auth/me` endpoint
- Cache at 30-60 second TTL
- Validates end-to-end flow

### Phase 2 (Next Week)
- Switch product-subgraph to use `/auth/introspect`
- Prepare cart/order services to use introspect from day 1
- Add distributed caching (Redis) if needed

### Phase 3+ (Future)
- Optional: Add IP-based caller validation for security
- Optional: Add signature-based caller authentication
- Optional: Central authorization service with cached policies
