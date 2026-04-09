export function authOpenApi() {
  const tags = [{ name: 'Auth' }];

  const schemas = {
    PublicUser: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        displayName: { type: 'string' },
        avatarUrl: { type: ['string', 'null'] },
      },
      required: ['id', 'email', 'displayName', 'avatarUrl'],
    },

    RegisterRequest: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 6 },
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
      },
      required: ['email', 'password', 'displayName'],
    },

    LoginRequest: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 1 },
      },
      required: ['email', 'password'],
    },

    AuthResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        user: { $ref: '#/components/schemas/PublicUser' },
      },
      required: ['accessToken', 'user'],
    },

    RefreshResponse: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
      },
      required: ['accessToken'],
    },

    LogoutResponse: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
      required: ['ok'],
    },

    ForgotPasswordRequest: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
      required: ['email'],
    },

    ForgotPasswordResponse: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        resetUrl: { type: 'string' },
        devResetToken: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
      required: ['ok'],
      additionalProperties: false,
    },

    ResetPasswordRequest: {
      type: 'object',
      properties: {
        token: { type: 'string', minLength: 1 },
        newPassword: { type: 'string', minLength: 6 },
      },
      required: ['token', 'newPassword'],
    },

    ResetPasswordResponse: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
      },
      required: ['ok'],
    },
  };

  const paths = {
    '/api/users/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '409': { description: 'Email exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/users/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/users/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicUser' },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/users/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh access token (uses refresh cookie)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RefreshResponse' },
              },
            },
          },
          '401': { description: 'Invalid refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/api/users/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (revokes refresh token cookie)',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LogoutResponse' },
              },
            },
          },
        },
      },
    },

    '/api/users/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Start password reset (dev returns token)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ForgotPasswordRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ForgotPasswordResponse' },
              },
            },
          },
        },
      },
    },

    '/api/users/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Finish password reset using reset token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ResetPasswordRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResetPasswordResponse' },
              },
            },
          },
          '400': { description: 'Invalid/expired token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  };

  return { tags, schemas, paths };
}
