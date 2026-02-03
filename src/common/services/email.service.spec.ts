import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string): string | number | undefined => {
      const config: { [key: string]: string | number } = {
        'email.smtp.host': 'smtp.test.com',
        'email.smtp.port': 587,
        'email.smtp.user': 'test@test.com',
        'email.smtp.password': 'testpassword',
        'email.from': 'noreply@test.com',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateTrackingActivatedEmail', () => {
    it('should generate HTML email with order details', () => {
      const orderData = {
        externalOrderId: 'ORD-123',
        itemSummary: 'Test Item',
        deliveryAddress: 'Test Address',
        currentStatus: 'PENDING',
      };

      const html = service.generateTrackingActivatedEmail(orderData);

      expect(html).toContain('ORD-123');
      expect(html).toContain('Test Item');
      expect(html).toContain('Test Address');
      expect(html).toContain('PENDING');
      expect(html).toContain('Order Tracking Activated');
    });
  });

  describe('generateStatusUpdateEmail', () => {
    it('should generate HTML email with status update', () => {
      const orderData = {
        externalOrderId: 'ORD-123',
        itemSummary: 'Test Item',
      };

      const html = service.generateStatusUpdateEmail(
        orderData,
        'IN_TRANSIT',
        'Package shipped',
      );

      expect(html).toContain('ORD-123');
      expect(html).toContain('IN TRANSIT');
      expect(html).toContain('Package shipped');
      expect(html).toContain('🚚');
    });

    it('should handle missing note gracefully', () => {
      const orderData = {
        externalOrderId: 'ORD-123',
        itemSummary: 'Test Item',
      };

      const html = service.generateStatusUpdateEmail(orderData, 'DELIVERED');

      expect(html).toContain('DELIVERED');
      expect(html).not.toContain('Update Note');
    });
  });
});
