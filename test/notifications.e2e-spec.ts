import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/common/services/email.service';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let webhookSecret: string;

  // Mock email service to avoid sending real emails
  const mockEmailService = {
    generateTrackingActivatedEmail: jest
      .fn()
      .mockReturnValue('<html>Test</html>'),
    generateStatusUpdateEmail: jest.fn().mockReturnValue('<html>Test</html>'),
    sendEmail: jest
      .fn()
      .mockResolvedValue({ success: true, messageId: 'test-123' }),
    sendTestEmail: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Create test company
    const company = await prisma.company.create({
      data: {
        companyName: 'Notification Test Corp',
        businessEmail: 'notif-test@example.com',
        password: 'hashed',
        isEmailVerified: true,
        kycStatus: 'APPROVED',
        webhookSecret: 'notif-test-secret',
        isWebhookActive: true,
      },
    });

    webhookSecret = company.webhookSecret;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.order.deleteMany();
    await prisma.company.deleteMany();
    await app.close();
  });

  it('should send notification when order is created', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/webhooks/order-received')
      .set('X-Webhook-Secret', webhookSecret)
      .send({
        externalOrderId: 'NOTIF-TEST-001',
        customerEmail: 'customer@example.com',
        itemSummary: 'Test Product',
        deliveryAddress: 'Test Address',
      })
      .expect(200);

    const orderId = response.body.orderId;

    // Wait a bit for async notification
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify email was attempted
    expect(mockEmailService.sendEmail).toHaveBeenCalled();

    // Verify notification logged in database
    const notifications = await prisma.notification.findMany({
      where: { orderId },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('TRACKING_ACTIVATED');
    expect(notifications[0].status).toBe('SENT');
    expect(notifications[0].recipient).toBe('customer@example.com');
  });

  it('should send notification when status is updated', async () => {
    // Create order first
    const orderResponse = await request(app.getHttpServer())
      .post('/api/v1/webhooks/order-received')
      .set('X-Webhook-Secret', webhookSecret)
      .send({
        externalOrderId: 'NOTIF-TEST-002',
        customerEmail: 'customer2@example.com',
        itemSummary: 'Test Product 2',
        deliveryAddress: 'Test Address 2',
      });

    const orderId = orderResponse.body.orderId;

    jest.clearAllMocks();

    // Update status
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/status-update')
      .set('X-Webhook-Secret', webhookSecret)
      .send({
        externalOrderId: 'NOTIF-TEST-002',
        newStatus: 'IN_TRANSIT',
        note: 'Test note',
      })
      .expect(200);

    // Wait for async notification
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify status update email sent
    expect(mockEmailService.sendEmail).toHaveBeenCalled();

    // Verify notification logged
    const notifications = await prisma.notification.findMany({
      where: {
        orderId,
        type: 'STATUS_UPDATE',
      },
    });

    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].status).toBe('SENT');
  });
});
