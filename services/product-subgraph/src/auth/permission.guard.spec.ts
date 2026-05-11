import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard (Unit Tests)', () => {
  let guard: PermissionGuard;
  let mockReflector: Partial<Reflector>;

  beforeEach(async () => {
    mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
  });

  describe('canActivate', () => {
    it('should allow when no permissions are required', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      (mockReflector.get as jest.Mock).mockReturnValue(null);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow when actor has required permission', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['SELLER'],
          permissions: ['products:write', 'products:read'],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['products:write']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow when actor has permission matching wildcard', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['ADMIN'],
          permissions: ['admin:users:read', 'admin:users:write', 'admin:products:*'],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['admin:products:*']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny when actor lacks required permission', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['BUYER'],
          permissions: ['products:read'],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['products:write']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when actor is missing', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: null,
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['products:write']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should handle multiple required permissions (OR logic)', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['SELLER'],
          permissions: ['products:read', 'inventory:write'],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue([
        'products:write',
        'inventory:write',
      ]);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle empty permissions array gracefully', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['BUYER'],
          permissions: [],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['products:write']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should handle undefined permissions gracefully', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['BUYER'],
          permissions: undefined,
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['products:write']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });
});
