import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    order: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrdersByCompany', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          externalOrderId: 'ORD-001',
          customerEmail: 'customer@example.com',
          currentStatus: 'PENDING',
          statusHistory: [{ status: 'PENDING', timestamp: new Date() }],
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(1);

      const result = await service.getOrdersByCompany('company-123', 1, 20);

      expect(result).toEqual({
        data: mockOrders,
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { companyId: 'company-123' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      });
    });

    it('should calculate pagination correctly', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(45);

      const result = await service.getOrdersByCompany('company-123', 2, 20);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 45,
        pages: 3, // 45 / 20 = 2.25 -> 3 pages
      });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (2 - 1) * 20
          take: 20,
        }),
      );
    });
  });

  describe('getOrderById', () => {
    it('should return order with full details', async () => {
      const mockOrder = {
        id: 'order-1',
        externalOrderId: 'ORD-001',
        companyId: 'company-123',
        statusHistory: [
          { status: 'PENDING', timestamp: new Date() },
          { status: 'IN_TRANSIT', timestamp: new Date() },
        ],
        notifications: [
          { id: 'notif-1', type: 'TRACKING_ACTIVATED', status: 'SENT' },
        ],
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('order-1', 'company-123');

      expect(result).toEqual(mockOrder);
      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'order-1',
          companyId: 'company-123',
        },
        include: {
          statusHistory: {
            orderBy: { timestamp: 'desc' },
          },
          notifications: expect.any(Object),
        },
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.getOrderById('nonexistent', 'company-123'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getOrderById('nonexistent', 'company-123'),
      ).rejects.toThrow('Order not found');
    });

    it('should not return order from different company', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.getOrderById('order-1', 'wrong-company'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('trackOrderByEmail', () => {
    it('should return customer-friendly order tracking data', async () => {
      const mockOrder = {
        externalOrderId: 'ORD-001',
        currentStatus: 'IN_TRANSIT',
        itemSummary: 'Test Items',
        deliveryAddress: 'Test Address',
        createdAt: new Date(),
        company: {
          companyName: 'Test Merchant',
        },
        statusHistory: [
          { status: 'PENDING', note: 'Order received', timestamp: new Date() },
          { status: 'IN_TRANSIT', note: 'Shipped', timestamp: new Date() },
        ],
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.trackOrderByEmail(
        'customer@example.com',
        'ORD-001',
      );

      expect(result).toEqual({
        orderId: 'ORD-001',
        currentStatus: 'IN_TRANSIT',
        itemSummary: 'Test Items',
        deliveryAddress: 'Test Address',
        merchant: 'Test Merchant',
        createdAt: mockOrder.createdAt,
        timeline: expect.arrayContaining([
          expect.objectContaining({
            status: 'PENDING',
            note: 'Order received',
          }),
          expect.objectContaining({
            status: 'IN_TRANSIT',
            note: 'Shipped',
          }),
        ]),
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.trackOrderByEmail('customer@example.com', 'NONEXISTENT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrderStats', () => {
    it('should return order statistics with percentages', async () => {
      mockPrismaService.order.count.mockResolvedValue(100);
      mockPrismaService.order.groupBy.mockResolvedValue([
        { currentStatus: 'PENDING', _count: 20 },
        { currentStatus: 'IN_TRANSIT', _count: 30 },
        { currentStatus: 'DELIVERED', _count: 50 },
      ]);

      const result = await service.getOrderStats('company-123');

      expect(result).toEqual({
        total: 100,
        byStatus: {
          PENDING: { count: 20, percentage: '20.00' },
          IN_TRANSIT: { count: 30, percentage: '30.00' },
          DELIVERED: { count: 50, percentage: '50.00' },
        },
      });
    });

    it('should handle zero orders gracefully', async () => {
      mockPrismaService.order.count.mockResolvedValue(0);
      mockPrismaService.order.groupBy.mockResolvedValue([]);

      const result = await service.getOrderStats('company-123');

      expect(result).toEqual({
        total: 0,
        byStatus: {},
      });
    });
  });

  describe('searchOrders', () => {
    it('should search orders by external order ID', async () => {
      const mockOrders = [{ externalOrderId: 'ORD-001' }];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(1);

      const result = await service.searchOrders('company-123', {
        externalOrderId: 'ORD-001',
      });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-123',
            externalOrderId: {
              contains: 'ORD-001',
              mode: 'insensitive',
            },
          }),
        }),
      );

      expect(result.filters).toEqual({
        externalOrderId: 'ORD-001',
        customerEmail: undefined,
        status: undefined,
      });
    });

    it('should search orders by customer email', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.searchOrders('company-123', {
        customerEmail: 'customer@example.com',
      });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerEmail: {
              contains: 'customer@example.com',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should combine multiple search filters', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.searchOrders('company-123', {
        externalOrderId: 'ORD',
        customerEmail: 'customer',
        status: 'PENDING',
      });

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-123',
            externalOrderId: expect.any(Object),
            customerEmail: expect.any(Object),
            currentStatus: 'PENDING',
          }),
        }),
      );
    });
  });
});
