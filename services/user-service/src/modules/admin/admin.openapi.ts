export function adminOpenApi() {
  const tags = [{ name: "Admin" }];

  const schemas = {
    AdminSellerListItem: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        userId: { type: "string", format: "uuid" },
        shopName: { type: "string" },
        shopDesc: { type: ["string", "null"] },
        status: { type: "string" },
        tier: { type: "string" },
        isKycVerified: { type: "boolean" },
        totalProducts: { type: "integer" },
        totalOrders: { type: "integer" },
        avgRating: { type: ["number", "null"] },
        user: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            displayName: { type: "string" },
            roles: { type: "array", items: { type: "string" } },
          },
          required: ["id", "email", "displayName", "roles"],
          additionalProperties: false,
        },
      },
      required: [
        "id",
        "userId",
        "shopName",
        "shopDesc",
        "status",
        "tier",
        "isKycVerified",
        "totalProducts",
        "totalOrders",
        "avgRating",
        "user",
      ],
      additionalProperties: false,
    },
    AdminSellerListResponse: {
      type: "object",
      properties: {
        sellers: {
          type: "array",
          items: { $ref: "#/components/schemas/AdminSellerListItem" },
        },
      },
      required: ["sellers"],
      additionalProperties: false,
    },
  };

  const paths = {
    "/api/users/admin/sellers": {
      get: {
        tags: ["Admin"],
        summary: "List seller profiles for admin",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: {
              type: "string",
              enum: [
                "PENDING_VERIFICATION",
                "VERIFIED",
                "SUSPENDED",
                "BANNED",
              ],
            },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminSellerListResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/admin/sellers/{sellerProfileId}/approve": {
      post: {
        tags: ["Admin"],
        summary: "Approve seller profile",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sellerProfileId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SellerProfileResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/admin/sellers/{sellerProfileId}/suspend": {
      post: {
        tags: ["Admin"],
        summary: "Suspend seller profile",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sellerProfileId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SellerProfileResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/admin/sellers/{sellerProfileId}/ban": {
      post: {
        tags: ["Admin"],
        summary: "Ban seller profile",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sellerProfileId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SellerProfileResponse" },
              },
            },
          },
        },
      },
    },
  };

  return { tags, schemas, paths };
}
