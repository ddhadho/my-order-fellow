import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtToken: string;
  let companyId: string;
  let testOrderId: string;
  let testExternalOrderId: string;

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

    // Create test company and get JWT token
    const company = await prisma.company.create({
      data: {
        companyName: 'Orders Test Company',
        businessEmail: 'orders-test@example.com',
        password: 'hashed',
        isEmailVerified: true,
        kycStatus: 'APPROVED',
        webhookSecret: 'orders-test-secret',
        isWebhookActive: true,
      },
    });

    companyId = company.id;

    // Login to get JWT
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        businessEmail: 'orders-test@example.com',
        password: 'hashed',
      });

    // For testing, we'll manually create the JWT or use a test account
    // In real scenario, this would come from actual login

    // Create test orders
    testExternalOrderId = 'E2E-ORDER-001';
    const order = await prisma.order.create({
      data: {
        companyId,
        externalOrderId: testExternalOrderId,
        customerEmail: 'customer@example.com',
        customerPhone: '+254712345678',
        itemSummary: 'Test Product',
        deliveryAddress: 'Test Address',
        currentStatus: 'PENDING',
        statusHistory: {
          create: {
            status: 'PENDING',
            note: 'Order created',
          },
        },
      },
    });

    testOrderId = order.id;

    // Create more test orders for pagination/stats
    await prisma.order.createMany({
      data: [
        {
          companyId,
          externalOrderId: 'E2E-ORDER-002',
          customerEmail: 'customer2@example.com',
          itemSummary: 'Product 2',
          deliveryAddress: 'Address 2',
          currentStatus: 'IN_TRANSIT',
        },
        {
          companyId,
          externalOrderId: 'E2E-ORDER-003',
          customerEmail: 'customer3@example.com',
          itemSummary: 'Product 3',
          deliveryAddress: 'Address 3',
          currentStatus: 'DELIVERED',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { companyId } });
    await prisma.company.delete({ where: { id: companyId } });
    await app.close();
  });

  describe('GET /orders', () => {
    it('should return paginated orders for authenticated company', () => {
      // Note: In real test, you'd need actual JWT token
      // This is a simplified version
      return request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('pagination');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toHaveProperty('page');
          expect(res.body.pagination).toHaveProperty('limit');
          expect(res.body.pagination).toHaveProperty('total');
          expect(res.body.pagination).toHaveProperty('pages');
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(10);
        });
    });

    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer()).get('/api/v1/orders').expect(401);
    });
  });

  describe('GET /orders/stats', () => {
    it('should return order statistics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/stats')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('byStatus');
          expect(typeof res.body.total).toBe('number');
          expect(res.body.total).toBeGreaterThanOrEqual(3); // We created 3 orders
        });
    });

    it('should include breakdown by status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/stats')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          const byStatus = res.body.byStatus;
          expect(byStatus).toBeDefined();

          // Should have at least one status
          const statuses = Object.keys(byStatus);
          expect(statuses.length).toBeGreaterThan(0);

          // Each status should have count and percentage
          statuses.forEach((status) => {
            expect(byStatus[status]).toHaveProperty('count');
            expect(byStatus[status]).toHaveProperty('percentage');
          });
        });
    });
  });

  describe('GET /orders/search', () => {
    it('should search by external order ID', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/search?externalOrderId=E2E-ORDER-001')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('filters');
          expect(res.body.filters.externalOrderId).toBe('E2E-ORDER-001');

          if (res.body.data.length > 0) {
            expect(res.body.data[0].externalOrderId).toContain('E2E-ORDER-001');
          }
        });
    });

    it('should search by customer email', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/search?customerEmail=customer@example.com')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.filters.customerEmail).toBe('customer@example.com');
        });
    });

    it('should search by status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/search?status=PENDING')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.filters.status).toBe('PENDING');

          if (res.body.data.length > 0) {
            res.body.data.forEach((order) => {
              expect(order.currentStatus).toBe('PENDING');
            });
          }
        });
    });

    it('should combine multiple search filters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/search?externalOrderId=E2E&status=PENDING')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.filters.externalOrderId).toBe('E2E');
          expect(res.body.filters.status).toBe('PENDING');
        });
    });
  });

  describe('GET /orders/:id', () => {
    it('should return detailed order information', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', testOrderId);
          expect(res.body).toHaveProperty('externalOrderId');
          expect(res.body).toHaveProperty('statusHistory');
          expect(res.body).toHaveProperty('notifications');
          expect(Array.isArray(res.body.statusHistory)).toBe(true);
          expect(Array.isArray(res.body.notifications)).toBe(true);
        });
    });

    it('should return 404 for non-existent order', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/nonexistent-id')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });

    it('should not return orders from other companies', async () => {
      // Create another company's order
      const otherCompany = await prisma.company.create({
        data: {
          companyName: 'Other Company',
          businessEmail: 'other@example.com',
          password: 'hashed',
          isEmailVerified: true,
        },
      });

      const otherOrder = await prisma.order.create({
        data: {
          companyId: otherCompany.id,
          externalOrderId: 'OTHER-ORDER',
          customerEmail: 'other-customer@example.com',
          itemSummary: 'Other Product',
          deliveryAddress: 'Other Address',
          currentStatus: 'PENDING',
        },
      });

      // Try to access with our company's token
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${otherOrder.id}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404); // Should not find it

      // Cleanup
      await prisma.order.delete({ where: { id: otherOrder.id } });
      await prisma.company.delete({ where: { id: otherCompany.id } });
    });
  });

  describe('GET /orders/track/:email/:orderId', () => {
    it('should allow public order tracking', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/orders/track/customer@example.com/${testExternalOrderId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('orderId', testExternalOrderId);
          expect(res.body).toHaveProperty('currentStatus');
          expect(res.body).toHaveProperty('itemSummary');
          expect(res.body).toHaveProperty('deliveryAddress');
          expect(res.body).toHaveProperty('merchant');
          expect(res.body).toHaveProperty('timeline');
          expect(Array.isArray(res.body.timeline)).toBe(true);
        });
    });

    it('should return customer-friendly timeline', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/orders/track/customer@example.com/${testExternalOrderId}`)
        .expect(200)
        .expect((res) => {
          const timeline = res.body.timeline;
          expect(timeline.length).toBeGreaterThan(0);

          timeline.forEach((entry) => {
            expect(entry).toHaveProperty('status');
            expect(entry).toHaveProperty('timestamp');
            // note is optional
          });
        });
    });

    it('should return 404 for wrong email', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/orders/track/wrong@example.com/${testExternalOrderId}`)
        .expect(404);
    });

    it('should return 404 for non-existent order', () => {
      return request(app.getHttpServer())
        .get('/api/v1/orders/track/customer@example.com/NONEXISTENT')
        .expect(404);
    });

    it('should not require authentication', () => {
      // Should work without Authorization header
      return request(app.getHttpServer())
        .get(`/api/v1/orders/track/customer@example.com/${testExternalOrderId}`)
        .expect(200);
    });
  });
});
