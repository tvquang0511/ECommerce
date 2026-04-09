import { env } from '../env.js';
import { authOpenApi } from '../modules/auth/auth.openapi.js';

type OpenApiSpec = Record<string, any>;

export function buildOpenApiSpec(): OpenApiSpec {
  const auth = authOpenApi();

  return {
    openapi: '3.0.3',
    info: {
      title: 'ecommerce — user-service',
      version: '0.1.0',
      description: 'User/Auth REST APIs for the ecommerce learning project.',
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
    tags: [...auth.tags],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object', additionalProperties: true },
              },
              required: ['code', 'message', 'details'],
            },
          },
          required: ['error'],
        },
        ...auth.schemas,
      },
    },
    paths: {
      ...auth.paths,
    },
  };
}
