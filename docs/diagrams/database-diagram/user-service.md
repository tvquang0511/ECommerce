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

  USERS ||--o{ REFRESH_TOKENS : has
  USERS ||--o{ PASSWORD_RESET_TOKENS : has
```

Notes
- Prisma maps tables with `@@map`: `User -> users`, `RefreshToken -> refresh_tokens`, `PasswordResetToken -> password_reset_tokens`.
- `RefreshToken.tokenHash` and `PasswordResetToken.tokenHash` are stored as hashes (recommended) instead of raw tokens.
- Relationships are `onDelete: Cascade` from `users`.
