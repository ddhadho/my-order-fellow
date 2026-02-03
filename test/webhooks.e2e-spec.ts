import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let webhookSecret: string;
  let companyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1'); // Set global prefix for e2e tests

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get(PrismaService);
    await app.init();

    // Set up test company with webhook secret
    const company = await prisma.company.create({
      data: {
        companyName: 'Test E-commerce Corp',
        businessEmail: 'webhook-test@example.com',
        password: 'hashedpassword123',
        isEmailVerified: true,
        kycStatus: 'APPROVED',
        webhookSecret: 'test-webhook-secret-e2e-123',
        isWebhookActive: true,
      },
    });

    webhookSecret = company.webhookSecret;
    companyId = company.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.order.deleteMany({
      where: { companyId },
    });
    await prisma.company.delete({
      where: { id: companyId },
    });

    // Add a short delay to allow background processes (like notifications) to finish
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay

    await app.close();
  });

  describe('POST /webhooks/order-received', () => {
    it('should create order successfully with valid webhook secret', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: 'E2E-ORD-001',
          customerEmail: 'customer@example.com',
          customerPhone: '+254712345678',
          itemSummary: 'Test Product x2',
          deliveryAddress: '123 Test Street, Nairobi',
          initialStatus: 'PENDING',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('orderId');
          expect(res.body).toHaveProperty('trackingStatus', 'PENDING');
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should reject request without webhook secret', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .send({
          externalOrderId: 'E2E-ORD-002',
          customerEmail: 'customer@example.com',
          itemSummary: 'Test Product',
          deliveryAddress: '123 Test Street',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Missing or invalid X-Webhook-Secret header',
          );
        });
    });

    it('should reject request with invalid webhook secret', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', 'invalid-secret-123')
        .send({
          externalOrderId: 'E2E-ORD-003',
          customerEmail: 'customer@example.com',
          itemSummary: 'Test Product',
          deliveryAddress: '123 Test Street',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid webhook credentials');
        });
    });

    it('should return existing order on duplicate (idempotency)', async () => {
      const orderData = {
        externalOrderId: 'E2E-ORD-DUPLICATE',
        customerEmail: 'customer@example.com',
        itemSummary: 'Duplicate Test Product',
        deliveryAddress: '456 Duplicate Street',
      };

      // First request - creates order
      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send(orderData)
        .expect(200);

      const firstOrderId = firstResponse.body.orderId;

      // Second request - returns same order
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send(orderData)
        .expect(200);

      expect(secondResponse.body.orderId).toBe(firstOrderId);
      expect(secondResponse.body.message).toContain('already exists');
    });

    it('should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: 'E2E-ORD-004',
          customerEmail: 'not-an-email',
          itemSummary: 'Test Product',
          deliveryAddress: '123 Test Street',
        })
        .expect(400);
    });

    it('should reject missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: 'E2E-ORD-005',
          // Missing customerEmail, itemSummary, deliveryAddress
        })
        .expect(400);
    });

    it('should default to PENDING status if not provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: 'E2E-ORD-NO-STATUS',
          customerEmail: 'customer@example.com',
          itemSummary: 'Test Product',
          deliveryAddress: '123 Test Street',
          // No initialStatus provided
        })
        .expect(200);

      expect(response.body.trackingStatus).toBe('PENDING');
    });
  });

  describe('POST /webhooks/status-update', () => {
    let testOrderExternalId: string;

    beforeEach(async () => {
      // Create a test order for status updates
      testOrderExternalId = `E2E-STATUS-${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: testOrderExternalId,
          customerEmail: 'status-test@example.com',
          itemSummary: 'Status Test Product',
          deliveryAddress: '789 Status Street',
        });
    });

    it('should update order status successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: testOrderExternalId,
          newStatus: 'IN_TRANSIT',
          note: 'Package departed warehouse',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('previousStatus', 'PENDING');
          expect(res.body).toHaveProperty('newStatus', 'IN_TRANSIT');
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should reject request without webhook secret', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .send({
          externalOrderId: testOrderExternalId,
          newStatus: 'IN_TRANSIT',
        })
        .expect(401);
    });

    it('should return error for non-existent order', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: 'NON-EXISTENT-ORDER',
          newStatus: 'IN_TRANSIT',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('not found');
        });
    });

    it('should allow status update without note', () => {
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: testOrderExternalId,
          newStatus: 'OUT_FOR_DELIVERY',
          // No note provided
        })
        .expect(200);
    });

    it('should complete full order lifecycle', async () => {
      const lifecycleOrderId = `E2E-LIFECYCLE-${Date.now()}`;

      // 1. Create order
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/order-received')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: lifecycleOrderId,
          customerEmail: 'lifecycle@example.com',
          itemSummary: 'Lifecycle Test Product',
          deliveryAddress: 'Lifecycle Address',
        })
        .expect(200);

      // 2. Update to IN_TRANSIT
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: lifecycleOrderId,
          newStatus: 'IN_TRANSIT',
        })
        .expect(200);

      // 3. Update to OUT_FOR_DELIVERY
      await request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: lifecycleOrderId,
          newStatus: 'OUT_FOR_DELIVERY',
        })
        .expect(200);

      // 4. Update to DELIVERED
      const finalResponse = await request(app.getHttpServer())
        .post('/api/v1/webhooks/status-update')
        .set('X-Webhook-Secret', webhookSecret)
        .send({
          externalOrderId: lifecycleOrderId,
          newStatus: 'DELIVERED',
          note: 'Successfully delivered',
        })
        .expect(200);

      expect(finalResponse.body.newStatus).toBe('DELIVERED');
    });
  });
});
