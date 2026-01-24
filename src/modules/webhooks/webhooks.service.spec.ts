import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processOrderWebhook', () => {
    const companyId = 'company-123';
    const createOrderDto: CreateOrderDto = {
      externalOrderId: 'ORD-12345',
      customerEmail: 'customer@example.com',
      customerPhone: '+254712345678',
      itemSummary: '2x iPhone 15 Pro',
      deliveryAddress: '123 Main St, Nairobi',
      initialStatus: 'PENDING' as any,
    };

    it('should create a new order successfully', async () => {
      const mockOrder = {
        id: 'order-uuid',
        externalOrderId: 'ORD-12345',
        currentStatus: 'PENDING',
        companyId,
        ...createOrderDto,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.order.findUnique.mockResolvedValue(null);
      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      const result = await service.processOrderWebhook(
        companyId,
        createOrderDto,
      );

      expect(result).toEqual({
        success: true,
        orderId: 'order-uuid',
        trackingStatus: 'PENDING',
        message: 'Order received and tracking activated',
      });

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: {
          companyId_externalOrderId: {
            companyId,
            externalOrderId: 'ORD-12345',
          },
        },
      });

      expect(mockPrismaService.order.create).toHaveBeenCalledWith({
        data: {
          companyId,
          externalOrderId: 'ORD-12345',
          customerEmail: 'customer@example.com',
          customerPhone: '+254712345678',
          itemSummary: '2x iPhone 15 Pro',
          deliveryAddress: '123 Main St, Nairobi',
          currentStatus: 'PENDING',
          statusHistory: {
            create: {
              status: 'PENDING',
              note: 'Order received and tracking initiated',
            },
          },
        },
      });
    });

    it('should return existing order if duplicate (idempotency)', async () => {
      const existingOrder = {
        id: 'existing-order-uuid',
        externalOrderId: 'ORD-12345',
        currentStatus: 'IN_TRANSIT',
        companyId,
      };

      mockPrismaService.order.findUnique.mockResolvedValue(existingOrder);

      const result = await service.processOrderWebhook(
        companyId,
        createOrderDto,
      );

      expect(result).toEqual({
        success: true,
        orderId: 'existing-order-uuid',
        trackingStatus: 'IN_TRANSIT',
        message: 'Order already exists',
      });

      expect(mockPrismaService.order.create).not.toHaveBeenCalled();
    });

    it('should default to PENDING status if not provided', async () => {
      const dtoWithoutStatus = { ...createOrderDto };
      delete dtoWithoutStatus.initialStatus;

      const mockOrder = {
        id: 'order-uuid',
        currentStatus: 'PENDING',
        ...dtoWithoutStatus,
      };

      mockPrismaService.order.findUnique.mockResolvedValue(null);
      mockPrismaService.order.create.mockResolvedValue(mockOrder);

      await service.processOrderWebhook(companyId, dtoWithoutStatus);

      expect(mockPrismaService.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentStatus: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('processStatusUpdateWebhook', () => {
    const companyId = 'company-123';
    const updateDto: UpdateOrderStatusDto = {
      externalOrderId: 'ORD-12345',
      newStatus: 'IN_TRANSIT' as any,
      note: 'Package departed warehouse',
    };

    it('should update order status successfully', async () => {
      const existingOrder = {
        id: 'order-uuid',
        externalOrderId: 'ORD-12345',
        currentStatus: 'PENDING',
        companyId,
      };

      const updatedOrder = {
        ...existingOrder,
        currentStatus: 'IN_TRANSIT',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await service.processStatusUpdateWebhook(
        companyId,
        updateDto,
      );

      expect(result).toEqual({
        success: true,
        orderId: 'order-uuid',
        previousStatus: 'PENDING',
        newStatus: 'IN_TRANSIT',
        message: 'Status updated successfully',
      });

      expect(mockPrismaService.order.findFirst).toHaveBeenCalledWith({
        where: {
          companyId,
          externalOrderId: 'ORD-12345',
        },
      });

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid' },
        data: {
          currentStatus: 'IN_TRANSIT',
          statusHistory: {
            create: {
              status: 'IN_TRANSIT',
              note: 'Package departed warehouse',
            },
          },
        },
      });
    });

    it('should throw error if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.processStatusUpdateWebhook(companyId, updateDto),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.processStatusUpdateWebhook(companyId, updateDto),
      ).rejects.toThrow('Order ORD-12345 not found');

      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should skip update if status unchanged', async () => {
      const existingOrder = {
        id: 'order-uuid',
        externalOrderId: 'ORD-12345',
        currentStatus: 'IN_TRANSIT',
        companyId,
      };

      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);

      const result = await service.processStatusUpdateWebhook(
        companyId,
        updateDto,
      );

      expect(result).toEqual({
        success: true,
        message: 'Status unchanged',
        currentStatus: 'IN_TRANSIT',
      });

      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('should create status history without note if not provided', async () => {
      const dtoWithoutNote = {
        externalOrderId: 'ORD-12345',
        newStatus: 'DELIVERED' as any,
      };

      const existingOrder = {
        id: 'order-uuid',
        currentStatus: 'OUT_FOR_DELIVERY',
        companyId,
        externalOrderId: 'ORD-12345',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(existingOrder);
      mockPrismaService.order.update.mockResolvedValue({
        ...existingOrder,
        currentStatus: 'DELIVERED',
      });

      await service.processStatusUpdateWebhook(companyId, dtoWithoutNote);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid' },
        data: {
          currentStatus: 'DELIVERED',
          statusHistory: {
            create: {
              status: 'DELIVERED',
              note: undefined,
            },
          },
        },
      });
    });
  });
});
