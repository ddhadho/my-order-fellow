import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;
  let emailService: EmailService;

  const mockPrismaService = {
    order: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEmailService = {
    generateTrackingActivatedEmail: jest.fn(),
    generateStatusUpdateEmail: jest.fn(),
    sendEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendTrackingActivatedNotification', () => {
    it('should send email and log notification', async () => {
      const mockOrder = {
        id: 'order-123',
        externalOrderId: 'ORD-123',
        customerEmail: 'customer@example.com',
        itemSummary: 'Test Item',
        deliveryAddress: 'Test Address',
        currentStatus: 'PENDING',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockEmailService.generateTrackingActivatedEmail.mockReturnValue(
        '<html>Test</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      });
      mockPrismaService.notification.create.mockResolvedValue({});

      await service.sendTrackingActivatedNotification('order-123');

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-123' },
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'customer@example.com',
        'Order ORD-123 - Tracking Activated',
        '<html>Test</html>',
      );

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-123',
          type: 'TRACKING_ACTIVATED',
          recipient: 'customer@example.com',
          status: 'SENT',
        }),
      });
    });

    it('should log failed notification', async () => {
      const mockOrder = {
        id: 'order-123',
        customerEmail: 'customer@example.com',
        externalOrderId: 'ORD-123',
        itemSummary: 'Test Item',
        deliveryAddress: 'Test Address',
        currentStatus: 'PENDING',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockEmailService.generateTrackingActivatedEmail.mockReturnValue(
        '<html>Test</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'SMTP error',
      });
      mockPrismaService.notification.create.mockResolvedValue({});

      await service.sendTrackingActivatedNotification('order-123');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMsg: 'SMTP error',
        }),
      });
    });

    it('should handle missing order gracefully', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await service.sendTrackingActivatedNotification('non-existent-order');

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockPrismaService.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendStatusUpdateNotification', () => {
    it('should send status update email successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        externalOrderId: 'ORD-123',
        customerEmail: 'customer@example.com',
        itemSummary: 'Test Item',
        currentStatus: 'IN_TRANSIT',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockEmailService.generateStatusUpdateEmail.mockReturnValue(
        '<html>Status Update</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-456',
      });
      mockPrismaService.notification.create.mockResolvedValue({});

      await service.sendStatusUpdateNotification(
        'order-123',
        'IN_TRANSIT',
        'Package in transit',
      );

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        'customer@example.com',
        'Order ORD-123 - Status Update',
        '<html>Status Update</html>',
      );

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'STATUS_UPDATE',
          status: 'SENT',
        }),
      });
    });

    it('should handle status update without note', async () => {
      const mockOrder = {
        id: 'order-123',
        externalOrderId: 'ORD-123',
        customerEmail: 'customer@example.com',
        itemSummary: 'Test Item',
        currentStatus: 'DELIVERED',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockEmailService.generateStatusUpdateEmail.mockReturnValue(
        '<html>Delivered</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockPrismaService.notification.create.mockResolvedValue({});

      await service.sendStatusUpdateNotification('order-123', 'DELIVERED');

      expect(mockEmailService.generateStatusUpdateEmail).toHaveBeenCalledWith(
        mockOrder,
        'DELIVERED',
        undefined,
      );
    });
  });

  describe('retryFailedNotifications', () => {
    it('should retry failed notifications successfully', async () => {
      const mockFailedNotifications = [
        {
          id: 'notif-1',
          type: 'TRACKING_ACTIVATED',
          recipient: 'customer1@example.com',
          subject: 'Order ORD-1 - Tracking Activated',
          order: {
            id: 'order-1',
            externalOrderId: 'ORD-1',
            customerEmail: 'customer1@example.com',
            currentStatus: 'PENDING',
          },
        },
        {
          id: 'notif-2',
          type: 'STATUS_UPDATE',
          recipient: 'customer2@example.com',
          subject: 'Order ORD-2 - Status Update',
          order: {
            id: 'order-2',
            externalOrderId: 'ORD-2',
            customerEmail: 'customer2@example.com',
            currentStatus: 'IN_TRANSIT',
          },
        },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(
        mockFailedNotifications,
      );
      mockEmailService.generateTrackingActivatedEmail.mockReturnValue(
        '<html>Tracking</html>',
      );
      mockEmailService.generateStatusUpdateEmail.mockReturnValue(
        '<html>Status</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockPrismaService.notification.update.mockResolvedValue({});

      const result = await service.retryFailedNotifications();

      expect(result).toEqual({
        total: 2,
        success: 2,
        failed: 0,
      });

      expect(mockPrismaService.notification.update).toHaveBeenCalledTimes(2);
    });

    it('should handle retry failures', async () => {
      const mockFailedNotifications = [
        {
          id: 'notif-1',
          type: 'TRACKING_ACTIVATED',
          recipient: 'customer@example.com',
          subject: 'Order ORD-1 - Tracking Activated',
          order: {
            id: 'order-1',
            externalOrderId: 'ORD-1',
            customerEmail: 'customer@example.com',
            currentStatus: 'PENDING',
          },
        },
      ];

      mockPrismaService.notification.findMany.mockResolvedValue(
        mockFailedNotifications,
      );
      mockEmailService.generateTrackingActivatedEmail.mockReturnValue(
        '<html>Test</html>',
      );
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: 'Still failing',
      });
      mockPrismaService.notification.update.mockResolvedValue({});

      const result = await service.retryFailedNotifications();

      expect(result).toEqual({
        total: 1,
        success: 0,
        failed: 1,
      });

      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMsg: 'Still failing',
        }),
      });
    });

    it('should return zero counts when no failed notifications exist', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);

      const result = await service.retryFailedNotifications();

      expect(result).toEqual({
        total: 0,
        success: 0,
        failed: 0,
      });

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});
