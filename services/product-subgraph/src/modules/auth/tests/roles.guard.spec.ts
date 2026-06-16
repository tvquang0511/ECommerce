import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RolesGuard } from '../guards/roles.guard';

describe('RolesGuard (Unit Tests)', () => {
  let guard: RolesGuard;
  let mockReflector: Partial<Reflector>;

  beforeEach(async () => {
    mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  describe('canActivate', () => {
    it('should allow when no roles are required', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      (mockReflector.get as jest.Mock).mockReturnValue(null);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow when actor has required role', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['ADMIN', 'MODERATOR'],
          permissions: [],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['ADMIN']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow when actor has role matching wildcard', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['ADMIN_PRODUCT', 'MODERATOR'],
          permissions: [],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['ADMIN_*']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny when actor lacks required role', () => {
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

      (mockReflector.get as jest.Mock).mockReturnValue(['ADMIN']);

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

      (mockReflector.get as jest.Mock).mockReturnValue(['ADMIN']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should handle multiple required roles (OR logic)', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['MODERATOR'],
          permissions: [],
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(['ADMIN', 'MODERATOR']);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
