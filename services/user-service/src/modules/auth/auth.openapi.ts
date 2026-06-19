export function authOpenApi() {
  const tags = [{ name: "Auth" }];

  const schemas = {
    PublicUser: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        displayName: { type: "string" },
        avatarUrl: { type: ["string", "null"] },
        emailVerified: { type: "boolean" },
        emailVerifiedAt: { type: ["string", "null"], format: "date-time" },
        bio: { type: ["string", "null"] },
        dateOfBirth: { type: ["string", "null"], format: "date" },
        phoneNumber: { type: ["string", "null"] },
        gender: {
          type: ["string", "null"],
          enum: ["MALE", "FEMALE", "OTHER", "UNSPECIFIED", null],
        },
        roles: {
          type: "array",
          items: { type: "string" },
        },
        permissions: {
          type: "array",
          items: { type: "string" },
        },
        sellerProfile: {
          type: ["object", "null"],
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
      },
      required: [
        "id",
        "email",
        "displayName",
        "avatarUrl",
        "emailVerified",
        "emailVerifiedAt",
        "bio",
        "dateOfBirth",
        "phoneNumber",
        "gender",
        "roles",
        "permissions",
        "sellerProfile",
      ],
    },

    RegisterRequest: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 6 },
        displayName: { type: "string", minLength: 1, maxLength: 100 },
      },
      required: ["email", "password", "displayName"],
    },

    LoginRequest: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 1 },
      },
      required: ["email", "password"],
    },

    AuthResponse: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
        user: { $ref: "#/components/schemas/PublicUser" },
      },
      required: ["accessToken", "user"],
    },

    RegisterResponse: {
      type: "object",
      properties: {
        requiresEmailVerification: { type: "boolean", enum: [true] },
        challengeId: { type: "string", format: "uuid" },
        expiresAt: { type: "string", format: "date-time" },
        devOtp: { type: "string" },
        user: { $ref: "#/components/schemas/PublicUser" },
      },
      required: ["requiresEmailVerification", "challengeId", "expiresAt", "user"],
      additionalProperties: false,
    },

    TwoFactorRequiredResponse: {
      type: "object",
      properties: {
        twoFactorRequired: { type: "boolean", enum: [true] },
        challengeId: { type: "string", format: "uuid" },
        expiresAt: { type: "string", format: "date-time" },
        devOtp: { type: "string" },
      },
      required: ["twoFactorRequired", "challengeId", "expiresAt"],
      additionalProperties: false,
    },

    LoginResponse: {
      oneOf: [
        { $ref: "#/components/schemas/AuthResponse" },
        { $ref: "#/components/schemas/TwoFactorRequiredResponse" },
      ],
    },

    VerifyTwoFactorRequest: {
      type: "object",
      properties: {
        challengeId: { type: "string", format: "uuid" },
        code: { type: "string", minLength: 6, maxLength: 6 },
      },
      required: ["challengeId", "code"],
    },

    VerifyEmailRequest: {
      type: "object",
      properties: {
        challengeId: { type: "string", format: "uuid" },
        code: { type: "string", minLength: 6, maxLength: 6 },
      },
      required: ["challengeId", "code"],
      additionalProperties: false,
    },

    TwoFactorStatusResponse: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
      required: ["enabled"],
      additionalProperties: false,
    },

    TwoFactorToggleRequest: {
      type: "object",
      properties: {
        password: { type: "string", minLength: 1 },
      },
      required: ["password"],
      additionalProperties: false,
    },

    TwoFactorToggleResponse: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
      },
      required: ["enabled"],
      additionalProperties: false,
    },

    RefreshRequest: {
      type: "object",
      description:
        "Optional. By default the refresh token is read from HttpOnly cookie. This body is supported mainly for API clients like Postman.",
      properties: {
        refreshToken: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },

    RefreshResponse: {
      type: "object",
      properties: {
        accessToken: { type: "string" },
      },
      required: ["accessToken"],
    },

    LogoutRequest: {
      type: "object",
      description:
        "Optional. If not provided, logout will revoke the refresh token from cookie (if present).",
      properties: {
        refreshToken: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },

    LogoutResponse: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
    },

    Session: {
      type: "object",
      properties: {
        id: { type: "string" },
        createdAt: { type: "string", format: "date-time" },
        lastUsedAt: { type: ["string", "null"], format: "date-time" },
        revokedAt: { type: ["string", "null"], format: "date-time" },
        createdByIp: { type: ["string", "null"] },
        createdByUserAgent: { type: ["string", "null"] },
        lastUsedIp: { type: ["string", "null"] },
        lastUsedUserAgent: { type: ["string", "null"] },
      },
      required: [
        "id",
        "createdAt",
        "lastUsedAt",
        "revokedAt",
        "createdByIp",
        "createdByUserAgent",
        "lastUsedIp",
        "lastUsedUserAgent",
      ],
      additionalProperties: false,
    },

    ListSessionsResponse: {
      type: "object",
      properties: {
        sessions: {
          type: "array",
          items: { $ref: "#/components/schemas/Session" },
        },
      },
      required: ["sessions"],
      additionalProperties: false,
    },

    ForgotPasswordRequest: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
      },
      required: ["email"],
    },

    ForgotPasswordResponse: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
      additionalProperties: false,
    },

    ResetPasswordRequest: {
      type: "object",
      properties: {
        token: { type: "string", minLength: 1 },
        newPassword: { type: "string", minLength: 6 },
      },
      required: ["token", "newPassword"],
    },

    ResetPasswordResponse: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
    },

    ChangePasswordRequest: {
      type: "object",
      properties: {
        currentPassword: { type: "string", minLength: 1 },
        newPassword: { type: "string", minLength: 6 },
      },
      required: ["currentPassword", "newPassword"],
      additionalProperties: false,
    },

    ChangePasswordResponse: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
      additionalProperties: false,
    },
  };

  const paths = {
    "/api/users/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            headers: {
              "Set-Cookie": {
                description: "Sets HttpOnly refresh token cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "409": {
            description: "Email exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/verify-email": {
      post: {
        tags: ["Auth"],
        summary: "Verify email ownership with OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyEmailRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ForgotPasswordResponse" },
              },
            },
          },
          "400": {
            description: "Invalid/expired OTP",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/verify-email/resend": {
      post: {
        tags: ["Auth"],
        summary: "Resend email verification OTP",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ForgotPasswordResponse" },
              },
            },
          },
          "429": {
            description: "Rate limited",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (may require 2FA OTP)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            headers: {
              "Set-Cookie": {
                description:
                  "If 2FA is NOT required, sets HttpOnly refresh token cookie. If 2FA is required, cookie is set after /2fa/verify.",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Rate limited",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/2fa/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify 2FA OTP and finish login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyTwoFactorRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            headers: {
              "Set-Cookie": {
                description: "Sets HttpOnly refresh token cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": {
            description: "Invalid/expired OTP",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Rate limited",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/2fa": {
      get: {
        tags: ["Auth"],
        summary: "Get 2FA status for current user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TwoFactorStatusResponse",
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/2fa/enable": {
      post: {
        tags: ["Auth"],
        summary: "Enable 2FA (requires password confirmation)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TwoFactorToggleRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TwoFactorToggleResponse",
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized/invalid password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/2fa/disable": {
      post: {
        tags: ["Auth"],
        summary: "Disable 2FA (requires password confirmation)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TwoFactorToggleRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/TwoFactorToggleResponse",
                },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized/invalid password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicUser" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token (rotates refresh token)",
        description:
          "By default, reads refresh token from HttpOnly cookie. You can also send {refreshToken} in JSON body for tools like Postman. In multi-device mode, refresh rotates only the current session (device).",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            headers: {
              "Set-Cookie": {
                description: "Rotates (replaces) HttpOnly refresh token cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshResponse" },
              },
            },
          },
          "401": {
            description: "Invalid refresh token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Rate limited",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/sessions": {
      get: {
        tags: ["Auth"],
        summary: "List active and revoked sessions (devices)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListSessionsResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/sessions/{sessionId}/revoke": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a session (logout a device)",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "404": {
            description: "Session not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/logout-all": {
      post: {
        tags: ["Auth"],
        summary: "Logout all devices (revoke all sessions)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            headers: {
              "Set-Cookie": {
                description: "Clears refresh token cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (revokes refresh token cookie)",
        description:
          "By default, revokes refresh token from HttpOnly cookie. You can also send {refreshToken} in JSON body for tools like Postman.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LogoutRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            headers: {
              "Set-Cookie": {
                description: "Clears refresh token cookie",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Start password reset (enqueues email)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ForgotPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ForgotPasswordResponse" },
              },
            },
          },
          "503": {
            description: "OTP/reset email delivery unavailable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Rate limited",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Finish password reset using reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ResetPasswordResponse" },
              },
            },
          },
          "400": {
            description: "Invalid/expired token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },

    "/api/users/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change password for current user (requires current password)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChangePasswordResponse" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "401": {
            description: "Unauthorized/invalid password",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  };

  return { tags, schemas, paths };
}
