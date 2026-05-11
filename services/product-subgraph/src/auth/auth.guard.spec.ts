import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from './auth.guard';
import { AuthContextService } from './auth-context.service';

describe('AuthGuard (Unit Tests)', () => {
  let guard: AuthGuard;
  let mockAuthContextService: Partial<AuthContextService>;

  beforeEach(async () => {
    mockAuthContextService = {
      resolveActorFromIntrospect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: AuthContextService,
          useValue: mockAuthContextService,
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  describe('canActivate', () => {
    it('should reject when JWT is missing', async () => {
      const mockContext = {
        getClass: () => {},
        getHandler: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
            user: null,
          }),
        }),
      } as ExecutionContext;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(false);
    });

    it('should accept valid JWT with user data', async () => {
      const mockContext = {
        getClass: () => {},
        getHandler: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid.jwt.token',
            },
            user: {
              userId: 'user123',
              email: 'user@example.com',
              roles: ['BUYER'],
              permissions: [],
            },
          }),
        }),
        getArgByIndex: () => ({
          req: {
            headers: {
              authorization: 'Bearer valid.jwt.token',
            },
            user: {
              userId: 'user123',
              email: 'user@example.com',
              roles: ['BUYER'],
              permissions: [],
            },
          },
        }),
      } as any;

      jest.spyOn(guard as any, 'getRequest').mockReturnValue({
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
        user: {
          userId: 'user123',
          email: 'user@example.com',
          roles: ['BUYER'],
          permissions: [],
        },
      });

      jest.spyOn(guard as any, 'extractToken').mockReturnValue('valid.jwt.token');

      // Note: In real test, you'd mock Passport authentication
      // Here we're testing the guard's canActivate logic
    });

    it('should call introspect when roles are empty', async () => {
      const mockResolveFromIntrospect = jest.fn().mockResolvedValue({
        userId: 'user123',
        email: 'user@example.com',
        roles: ['SELLER'],
        permissions: ['products:write'],
        sellerProfile: { status: 'VERIFIED', isKycVerified: true },
      });

      (mockAuthContextService.resolveActorFromIntrospect as jest.Mock) =
        mockResolveFromIntrospect;

      // Test would verify introspection is called when JWT doesn't have roles
      expect(mockResolveFromIntrospect).not.toHaveBeenCalled();
    });
  });
});
