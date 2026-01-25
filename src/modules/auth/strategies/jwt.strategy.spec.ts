import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-jwt-secret'),
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return company if valid payload', async () => {
      const payload = { sub: 'company-123', email: 'test@example.com' };
      const mockCompany = {
        id: 'company-123',
        companyName: 'Test Company',
        businessEmail: 'test@example.com',
      };

      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockCompany);
      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-123' },
      });
    });

    it('should throw UnauthorizedException if company not found', async () => {
      const payload = { sub: 'nonexistent-id', email: 'test@example.com' };

      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
