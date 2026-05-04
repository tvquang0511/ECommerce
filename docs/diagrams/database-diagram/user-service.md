# user-service — Database diagram

Source of truth: `services/user-service/prisma/schema.prisma`

```mermaid
erDiagram
  USERS {
    uuid id PK
    varchar email "UNIQUE"
    varchar password_hash
    varchar display_name
    varchar avatar_url "NULL"
    timestamptz created_at
    timestamptz updated_at
  }

  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    varchar token_hash "UNIQUE"
    timestamptz expires_at
    timestamptz revoked_at "NULL"
    timestamptz created_at
  }

  PASSWORD_RESET_TOKENS {
    uuid id PK
    uuid user_id FK
    varchar token_hash "UNIQUE"
    timestamptz expires_at
    timestamptz used_at "NULL"
    varchar requested_ip "NULL"
    varchar user_agent "NULL"
    timestamptz created_at
  }

  ROLES {
    uuid id PK
    varchar name "UNIQUE"
    varchar display_name
    varchar description "NULL"
    boolean is_public
    timestamptz created_at
    timestamptz updated_at
  }

  USER_ROLES {
    uuid id PK
    uuid user_id FK
    uuid role_id FK
    timestamptz assigned_at
    timestamptz expires_at "NULL"
  }

  PERMISSIONS {
    uuid id PK
    varchar name "UNIQUE"
    varchar description "NULL"
    varchar category
  }

  ROLE_PERMISSIONS {
    uuid id PK
    uuid role_id FK
    uuid permission_id FK
  }

  USER_PERMISSIONS {
    uuid id PK
    uuid user_id FK
    uuid permission_id FK
    timestamptz assigned_at
    timestamptz expires_at "NULL"
  }

  SELLER_PROFILES {
    uuid id PK
    uuid user_id FK "UNIQUE"
    varchar shop_name "UNIQUE"
    varchar shop_desc "NULL"
    varchar status
    varchar tier
    boolean is_kyc_verified
    int total_products
    int total_orders
    float avg_rating "NULL"
    timestamptz created_at
    timestamptz updated_at
  }

  AUDIT_LOGS {
    uuid id PK
    varchar event_type
    uuid actor_user_id "NULL"
    uuid target_user_id "NULL"
    uuid session_id "NULL"
    json metadata "NULL"
    timestamptz created_at
  }

  USERS ||--o{ REFRESH_TOKENS : has
  USERS ||--o{ PASSWORD_RESET_TOKENS : has
  USERS ||--o{ USER_ROLES : has
  USERS ||--o{ USER_PERMISSIONS : has
  USERS ||--o| SELLER_PROFILES : owns
  USERS ||--o{ AUDIT_LOGS : actor
  USERS ||--o{ AUDIT_LOGS : target
  ROLES ||--o{ USER_ROLES : assigned_to
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : mapped_in
  PERMISSIONS ||--o{ USER_PERMISSIONS : assigned_in
```

Notes
- Prisma maps tables with `@@map`: `User -> users`, `RefreshToken -> refresh_tokens`, `PasswordResetToken -> password_reset_tokens`.
- RBAC được biểu diễn qua các bảng `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions` và `seller_profiles`.
- `RefreshToken.tokenHash` and `PasswordResetToken.tokenHash` are stored as hashes (recommended) instead of raw tokens.
- Relationships are `onDelete: Cascade` from `users`.
