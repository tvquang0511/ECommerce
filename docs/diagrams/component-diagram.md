# Component Diagram — E-commerce Microservices (Nginx + Apollo Federation)

> GitHub không render PlantUML mặc định. Bạn có thể:
> - Dùng VS Code extension “PlantUML” để preview.
> - Export PNG/SVG nếu muốn embed vào README.

```plantuml
@startuml
skinparam componentStyle rectangle
left to right direction

actor "User" as User

component "Web Frontend\nNext.js" as FE
component "Nginx\n(reverse proxy)\n(optional in dev)" as NGINX
component "GraphQL Gateway\nApollo Federation" as GW

component "User Service\nNode/Express + TS\nREST" as US

component "Product Subgraph\nNestJS GraphQL\n(Federation Subgraph)" as PRS
component "Cart Subgraph\nNestJS GraphQL\n(Federation Subgraph)" as CS
component "Order Subgraph\nNestJS GraphQL\n(Federation Subgraph)" as OS

component "Inventory Service\nNestJS + TS\nREST" as IS
component "Payment Service\nNestJS + TS\nREST" as PS

component "Notification Worker\nNode/Nest\nSMTP" as NS

database "Postgres\n(users)" as UDB
database "MongoDB\n(catalog)" as MDB
database "Redis\n(carts + cache)" as RDB
database "MinIO\n(object storage)" as MINIO
database "Postgres\n(orders + outbox)" as ODB
database "Postgres\n(inventory)" as IDB
database "Postgres\n(payments)" as PDB

queue "RabbitMQ" as RMQ
component "SMTP Provider" as SMTP

User --> FE : HTTPS
FE --> NGINX : (prod-like)\noptional in dev
NGINX --> FE : serve frontend

NGINX --> GW : proxy /graphql\n(forward Authorization)
NGINX --> US : proxy /api/users/*\n(login/refresh/logout)

FE --> US : REST auth\n(refresh token cookie)
FE --> GW : GraphQL\n(access token)

GW --> PRS : GraphQL (subgraph)
GW --> CS : GraphQL (subgraph)
GW --> OS : GraphQL (subgraph)

OS --> IS : REST (reserve/release)
OS --> PS : REST (authorize/capture)

US --> UDB : Prisma/SQL
PRS --> MDB : Mongo driver/ODM
PRS --> RDB : Redis cache\n(product list/detail)
CS --> RDB : Redis store\n(carts)
PRS --> MINIO : S3 API\n(presigned URLs)
OS --> ODB : Prisma/SQL
IS --> IDB : Prisma/SQL
PS --> PDB : Prisma/SQL

US <--> RMQ : publish/consume
PRS <--> RMQ : publish/consume
CS <--> RMQ : publish/consume
OS <--> RMQ : publish/consume\n(outbox publisher)
IS <--> RMQ : publish/consume
PS <--> RMQ : publish/consume

NS <--> RMQ : consume events
NS --> SMTP : send email

note right of RDB
  Redis có 2 vai trò:
  - Cart store (primary): cart:*
  - Cache catalog: cache:product:*
  Dev có thể dùng chung 1 instance.
end note

note right of MINIO
  Lưu blobs (product images).
  Metadata (objectKey, size, contentType)
  lưu trong MongoDB.
  UI upload/download qua presigned URLs.
end note

note right of US
  Refresh token: HttpOnly cookie
  Access token: Bearer header
  Services verify JWT locally
  (HS256 first, later JWKS)
end note

@enduml
```
