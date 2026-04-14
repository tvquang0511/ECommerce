export function usersOpenApi() {
  const tags = [{ name: 'Users' }];

  const schemas = {
    UpdateMeRequest: {
      type: 'object',
      properties: {
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
        bio: { type: ['string', 'null'], maxLength: 500 },
        dateOfBirth: { type: ['string', 'null'], format: 'date' },
        phoneNumber: { type: ['string', 'null'], minLength: 6, maxLength: 30 },
        gender: { type: ['string', 'null'], enum: ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED', null] },
      },
      additionalProperties: false,
    },
  };

  const paths = {
    '/api/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get current user profile',
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
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update current user profile',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateMeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicUser' },
              },
            },
          },
          '409': {
            description: 'Conflict (unique constraint)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '400': {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/api/users/me/avatar': {
      post: {
        tags: ['Users'],
        summary: 'Upload avatar for current user',
        description:
          'Accepts multipart/form-data with a single file field named "avatar". Uploads to MinIO (public bucket) and updates user.avatarUrl to the public object URL.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  avatar: { type: 'string', format: 'binary' },
                },
                required: ['avatar'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicUser' },
              },
            },
          },
          '400': {
            description: 'Invalid file or request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
  };

  return { tags, schemas, paths };
}
