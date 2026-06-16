import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { VerifiedSellerGuard } from '../guards/verified-seller.guard';

describe('VerifiedSellerGuard (Unit Tests)', () => {
  let guard: VerifiedSellerGuard;
  let mockReflector: Partial<Reflector>;

  beforeEach(async () => {
    mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifiedSellerGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<VerifiedSellerGuard>(VerifiedSellerGuard);
  });

  describe('canActivate', () => {
    it('should allow when verification is not required', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      (mockReflector.get as jest.Mock).mockReturnValue(false);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should allow fully verified seller', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'seller123',
          roles: ['SELLER'],
          permissions: ['products:write'],
          sellerProfile: {
            status: 'VERIFIED',
            isKycVerified: true,
          },
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(true);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should deny user without SELLER role', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'user123',
          roles: ['BUYER'],
          permissions: [],
          sellerProfile: null,
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(true);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should deny seller with unverified status', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'seller123',
          roles: ['SELLER'],
          permissions: [],
          sellerProfile: {
            status: 'PENDING',
            isKycVerified: false,
          },
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(true);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });

    it('should deny seller without KYC verification', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'seller123',
          roles: ['SELLER'],
          permissions: [],
          sellerProfile: {
            status: 'VERIFIED',
            isKycVerified: false,
          },
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(true);

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

      (mockReflector.get as jest.Mock).mockReturnValue(true);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('should handle missing sellerProfile gracefully', () => {
      const mockExecutionContext = {
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockGqlContext = {
        actor: {
          userId: 'seller123',
          roles: ['SELLER'],
          permissions: [],
          sellerProfile: null,
        },
      };

      (mockReflector.get as jest.Mock).mockReturnValue(true);

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => mockGqlContext,
      } as any);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(ForbiddenException);
    });
  });
});
