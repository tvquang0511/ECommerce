# Next.js web proxy for `user-service`

## 1) Problem we’re solving

When the browser calls `user-service` directly (e.g. `http://localhost:4001/api/users/auth/login`), you run into a few practical issues:

- **CORS + preflight noise**: cross-origin `fetch` with JSON triggers `OPTIONS` preflight. You saw logs like `OPTIONS ... 204`.
- **Cookie-based refresh** is more fragile cross-origin:
  - You must configure CORS precisely (`credentials: true`, allow origin, etc.).
  - Browsers apply stricter rules for third‑party cookies depending on SameSite/secure.
- **Leaking internal service URLs**: putting `user-service` base URL in `NEXT_PUBLIC_*` makes it visible to the browser bundle.
- **Hard to scale to more services**: each new service needs its own public base URL + CORS setup.

## 2) The proxy approach

We make the browser talk only to the Next.js app origin:

- Browser calls: `http://localhost:3000/api/users/...`
- Next.js server forwards to: `${USER_SERVICE_URL}/api/users/...`

In this repo we intentionally keep the **same path prefix** (`/api/users/*`) so `user-service` can continue setting refresh cookies with:

- `Path=/api/users/auth`

That cookie then correctly applies to Next.js routes under the same prefix.

## 3) Why this is better

### a) No CORS required for auth flows
Same-origin calls don’t need browser CORS. You avoid the preflight and most CORS misconfigurations.

### b) Cookies behave as first-party
Refresh cookies are set by the Next.js origin and treated as first-party for the app.

### c) Server-only configuration
We switch from `NEXT_PUBLIC_USER_SERVICE_URL` to server-only:

- `USER_SERVICE_URL=http://localhost:4001`

This keeps infrastructure details out of the browser bundle.

### d) Easier extensibility
You can add more proxies later using the same pattern:

- `/api/orders/*` → `ORDER_SERVICE_URL`
- `/api/products/*` → `PRODUCT_SERVICE_URL`

## 4) Implementation details

### a) Proxy route handler
File:
- `apps/web/src/app/api/users/[...path]/route.ts`

Behavior:
- Accepts requests to `/api/users/*`
- Forwards method/headers/body to upstream
- Returns upstream status/body
- **Forwards `set-cookie` headers** so refresh cookies still work

### b) Frontend API client change
File:
- `apps/web/src/lib/http/userService.ts`

Behavior:
- Uses **relative** URLs (`/api/users/...`) instead of a public base URL
- Still uses `credentials: 'include'` so the refresh cookie is sent

## 5) Gotchas / notes

- Make sure `user-service` is actually running on `USER_SERVICE_URL`.
- If you later change the refresh cookie path in `user-service`, ensure the proxy keeps matching that prefix.
- For production behind a gateway, you can keep the same idea (browser → gateway/Next → internal service).

## 6) Troubleshooting

### a) Browser shows 500 from `/api/users/...`

Most common cause: `USER_SERVICE_URL` is missing/invalid.

- Set `USER_SERVICE_URL=http://localhost:4001` in `apps/web/.env`
- Restart the Next dev server

### b) Browser shows 502 (`UPSTREAM_UNREACHABLE`)

Next.js cannot reach the upstream.

- Confirm user-service is running on the expected port
- If Next is running inside Docker, `localhost` will point to the container itself; use the Docker service name instead (e.g. `http://user-service:4001`).
