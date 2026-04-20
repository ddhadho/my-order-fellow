import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CompaniesService', () => {
  let service: CompaniesService;

  const mockCompany = {
    id: 'company-123',
    companyName: 'Test Corp',
    businessEmail: 'test@example.com',
    phoneNumber: '+254712345678',
    businessAddress: '123 Test St',
    kycStatus: 'PENDING',
    isWebhookActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    apiUsageLog: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return company profile', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);

      const result = await service.getProfile('company-123');

      expect(result).toEqual(mockCompany);
      expect(mockPrismaService.company.findUnique).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        select: expect.objectContaining({
          id: true,
          companyName: true,
          businessEmail: true,
        }),
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update company profile', async () => {
      const updated = { ...mockCompany, companyName: 'Updated Corp' };
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue(updated);

      const result = await service.updateProfile('company-123', {
        companyName: 'Updated Corp',
      });

      expect(result.companyName).toBe('Updated Corp');
      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: { companyName: 'Updated Corp' },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent', { companyName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided fields', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.update.mockResolvedValue(mockCompany);

      await service.updateProfile('company-123', {
        phoneNumber: '+254700000000',
      });

      expect(mockPrismaService.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: { phoneNumber: '+254700000000' },
        select: expect.any(Object),
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete company account', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(mockCompany);
      mockPrismaService.company.delete.mockResolvedValue(mockCompany);

      const result = await service.deleteAccount('company-123');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(mockPrismaService.company.delete).toHaveBeenCalledWith({
        where: { id: 'company-123' },
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrismaService.company.findUnique.mockResolvedValue(null);

      await expect(service.deleteAccount('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getApiUsageSummary', () => {
    it('should return usage summary for last 30 days', async () => {
      mockPrismaService.apiUsageLog.count.mockResolvedValue(150);
      mockPrismaService.apiUsageLog.groupBy
        .mockResolvedValueOnce([
          { endpoint: '/orders', method: 'GET', _count: 100 },
          { endpoint: '/webhooks', method: 'POST', _count: 50 },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getApiUsageSummary('company-123');

      expect(result.totalRequests).toBe(150);
      expect(result.period).toBe('30 days');
      expect(result.byEndpoint).toHaveLength(2);
    });
  });

  describe('getApiUsageLogs', () => {
    it('should return recent api usage logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          endpoint: '/orders',
          method: 'GET',
          statusCode: 200,
          createdAt: new Date(),
        },
      ];
      mockPrismaService.apiUsageLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getApiUsageLogs('company-123');

      expect(result).toEqual(mockLogs);
      expect(mockPrismaService.apiUsageLog.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: expect.any(Object),
      });
    });

    it('should respect custom limit', async () => {
      mockPrismaService.apiUsageLog.findMany.mockResolvedValue([]);

      await service.getApiUsageLogs('company-123', 10);

      expect(mockPrismaService.apiUsageLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
