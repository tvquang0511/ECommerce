export function sellersOpenApi() {
  const tags = [{ name: "Sellers" }];

  const schemas = {
    SellerProfile: {
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
      ],
      additionalProperties: false,
    },
    SellerProfileResponse: {
      type: "object",
      properties: {
        sellerProfile: {
          anyOf: [
            { $ref: "#/components/schemas/SellerProfile" },
            { type: "null" },
          ],
        },
      },
      required: ["sellerProfile"],
      additionalProperties: false,
    },
    ApplySellerRequest: {
      type: "object",
      properties: {
        shopName: { type: "string", minLength: 3, maxLength: 100 },
        shopDesc: { type: ["string", "null"], maxLength: 500 },
      },
      required: ["shopName"],
      additionalProperties: false,
    },
  };

  const paths = {
    "/api/users/seller/apply": {
      post: {
        tags: ["Sellers"],
        summary: "Apply to become a seller",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApplySellerRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SellerProfileResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/seller/me": {
      get: {
        tags: ["Sellers"],
        summary: "Get current user's seller profile",
        security: [{ bearerAuth: [] }],
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
