# pnpm guide (cho người quen npm)

Tài liệu này giúp bạn chuyển từ npm sang pnpm trong monorepo.

---

## 0) pnpm là gì (hiểu nhanh)
- pnpm cài dependencies theo kiểu **content-addressable store** + **symlink** vào từng project.
- Lợi ích: cài nhanh hơn, tiết kiệm disk, phù hợp monorepo.

---

## 1) Cài đặt (khuyến nghị: Corepack)

1) Bật Corepack:
- `corepack enable`

2) Kích hoạt đúng version (khớp `package.json#packageManager`):
- `corepack prepare pnpm@9.0.0 --activate`

3) Kiểm tra:
- `pnpm -v`

---

## 2) Mapping nhanh: npm ↔ pnpm

| npm | pnpm |
|---|---|
| `npm i` | `pnpm install` |
| `npm run dev` | `pnpm dev` hoặc `pnpm run dev` |
| `npm i axios` | `pnpm add axios` |
| `npm i -D tsx` | `pnpm add -D tsx` |
| `npm uninstall axios` | `pnpm remove axios` |
| `npx prisma studio` | `pnpm dlx prisma studio` |

---

## 3) Workspaces (điểm khác biệt quan trọng)

Repo này dùng workspaces qua `pnpm-workspace.yaml`.

### 3.1 Chạy lệnh ở root
- `pnpm -w <cmd>` (w = workspace root)
  - Ví dụ: `pnpm -w install`

### 3.2 Chạy lệnh cho 1 package/service
- `pnpm --filter <name> <script>`
  - Ví dụ: `pnpm --filter graphql-gateway dev`

Bạn có thể filter theo path:
- `pnpm --filter ./services/graphql-gateway dev`

### 3.3 Chạy lệnh cho nhiều package
- `pnpm -r <script>` (r = recursive)
  - Ví dụ: `pnpm -r dev`

> Tip: monorepo lớn thì filter kết hợp rất hữu ích.

---

## 4) Dependency scopes (đừng nhầm)

### 4.1 Thêm dependency cho 1 service
- Đang đứng ở root vẫn add được, nhưng phải filter:
  - `pnpm --filter product-subgraph add graphql`

### 4.2 Thêm dependency cho root
- `pnpm -w add -D eslint`

### 4.3 Thêm internal workspace package
- Nếu bạn tạo `packages/common` rồi muốn service dùng:
  - `pnpm --filter product-subgraph add @repo/common` (tên package do bạn đặt)

---

## 5) Lockfile và node_modules

- pnpm tạo `pnpm-lock.yaml` ở root.
- pnpm vẫn tạo `node_modules/` nhưng cấu trúc khác npm (nhiều symlink).

Nếu gặp issue tooling (hiếm), có 2 chế độ:
- Mặc định: `node-linker=isolated`
- Alternative: `node-linker=hoisted` (tương thích tốt hơn với tool cũ)

Bạn cấu hình bằng `.npmrc` ở root, ví dụ:
```ini
node-linker=isolated
```

---

## 6) Các lệnh hữu ích khi debug deps
- Xem vì sao package được cài: `pnpm why <pkg>`
- List deps: `pnpm list --depth 2`
- Update: `pnpm update`

---

## 7) Workflow khuyến nghị cho Milestone 0

1) Cài deps một lần:
- `pnpm install`

2) Chạy subgraph + gateway:
- `pnpm --filter product-subgraph dev`
- `pnpm --filter graphql-gateway dev`

3) Chạy hạ tầng (nếu cần DB/broker):
- `pnpm deps:up` hoặc `make dev-up`

---

## 8) Lỗi thường gặp

### 8.1 "Cannot find module ..." trong VS Code
- Thường là chưa chạy `pnpm install`.

### 8.2 Chạy filter không đúng
- Check đúng `name` trong `services/*/package.json`.

### 8.3 Dùng npx quen tay
- Thay bằng `pnpm dlx <pkg> ...`
