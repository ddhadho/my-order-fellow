import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Company, KycStatus, Role } from '@prisma/client';

// Utility function to get JWT token
const loginAndGetToken = async (
  app: INestApplication,
  email: string,
  password = 'SecurePass123!',
) => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ businessEmail: email, password });
  return res.body.accessToken;
};

describe('KYC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let regularUserToken: string;
  let adminUserToken: string;
  let regularUser: Company;
  let adminUser: Company;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get(PrismaService);
    await app.init();

    await prisma.kycInfo.deleteMany({});
    await prisma.company.deleteMany({
      where: { businessEmail: { contains: 'kyc-e2e' } },
    });

    // --- Helper function for full registration and login flow ---
    const registerVerifyAndLogin = async (
      email: string,
      companyName: string,
      role: Role,
      password = 'SecurePass123!',
    ) => {
      // 1. Register
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ companyName, businessEmail: email, password })
        .expect(201);

      const companyId = registerRes.body.companyId;
      let createdCompany = await prisma.company.findUnique({
        where: { id: companyId },
      });

      // 2. Update role if not default USER
      if (role !== Role.USER) {
        createdCompany = await prisma.company.update({
          where: { id: companyId },
          data: { role },
        });
      }

      // 3. Verify OTP
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ businessEmail: email, otp: createdCompany.emailOtp })
        .expect(201);

      // 4. Login
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ businessEmail: email, password })
        .expect(201);

      return { company: createdCompany, token: loginRes.body.accessToken };
    };

    // 1. Create, verify, and login a regular user
    const regularUserEmail = `kyc-e2e-regular-${Date.now()}@example.com`;
    const { company: regUser, token: regToken } = await registerVerifyAndLogin(
      regularUserEmail,
      'KYC E2E Regular',
      Role.USER,
    );
    regularUser = regUser;
    regularUserToken = regToken;

    // 2. Create, verify, and login an admin user
    const adminUserEmail = `kyc-e2e-admin-${Date.now()}@example.com`;
    const { company: admUser, token: admToken } = await registerVerifyAndLogin(
      adminUserEmail,
      'KYC E2E Admin',
      Role.ADMIN, // Ensure admin role is set
    );
    adminUser = admUser;
    adminUserToken = admToken;
  });

  afterAll(async () => {
    await prisma.kycInfo.deleteMany({});
    await prisma.company.deleteMany({
      where: { businessEmail: { contains: 'kyc-e2e' } },
    });
    await app.close();
  });

  describe('POST /kyc/submit', () => {
    it('should reject submission if not authenticated', () => {
      return request(app.getHttpServer())
        .post('/api/v1/kyc/submit')
        .send({
          businessRegistrationNo: 'BN123',
          businessAddress: '123 Test St',
          contactPersonName: 'Test User',
          contactPersonPhone: '+254712345678',
        })
        .expect(401);
    });

    it('should reject submission with invalid data', () => {
      return request(app.getHttpServer())
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          businessRegistrationNo: '', // Invalid
          businessAddress: '123 Test St',
        })
        .expect(400);
    });

    it('should allow an authenticated user to submit KYC', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          businessRegistrationNo: 'BN-REG-123',
          businessAddress: '123 Regular St, Test City',
          contactPersonName: 'Regular User',
          contactPersonPhone: '+254700000001',
        })
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty('kycId');
          expect(res.body.status).toEqual('PENDING');
        });

      const company = await prisma.company.findUnique({
        where: { id: regularUser.id },
      });
      expect(company.kycStatus).toEqual(KycStatus.PENDING);
    });

    it('should reject submission if KYC already pending or approved', async () => {
      // First submission is fine (done in previous test)
      // Try to submit again
      return request(app.getHttpServer())
        .post('/api/v1/kyc/submit')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          businessRegistrationNo: 'BN-REG-456',
          businessAddress: '456 Another St, Test City',
          contactPersonName: 'Regular User',
          contactPersonPhone: '+254700000002',
        })
        .expect(400) // Or 409 Conflict
        .then((res) => {
          expect(res.body.message).toContain('KYC already submitted');
        });
    });
  });

  describe('GET /kyc/pending', () => {
    it('should reject if user is not an admin', () => {
      return request(app.getHttpServer())
        .get('/api/v1/kyc/pending')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403); // Forbidden
    });

    it('should allow admin to get list of pending KYCs', async () => {
      // The regular user's KYC is pending from the previous test suite
      return request(app.getHttpServer())
        .get('/api/v1/kyc/pending')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          const pendingKyc = res.body.find(
            (k) => k.companyId === regularUser.id,
          );
          expect(pendingKyc).toBeDefined();
          expect(pendingKyc.status).toEqual('PENDING');
        });
    });
  });

  describe('POST /kyc/:kycId/review', () => {
    let kycToReviewId: string;

    beforeEach(async () => {
      const kyc = await prisma.kycInfo.findFirst({
        where: { companyId: regularUser.id },
      });
      kycToReviewId = kyc.id;
    });

    it('should reject if user is not an admin', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/kyc/${kycToReviewId}/review`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ decision: 'APPROVE', notes: 'Looks good' })
        .expect(403);
    });

    it('should allow admin to approve a KYC submission', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/kyc/${kycToReviewId}/review`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ decision: 'APPROVE', notes: 'All documents are valid.' })
        .expect(201)
        .then((res) => {
          expect(res.body.status).toEqual(KycStatus.APPROVED);
        });

      const updatedCompany = await prisma.company.findUnique({
        where: { id: regularUser.id },
      });
      expect(updatedCompany.kycStatus).toEqual(KycStatus.APPROVED);
      expect(updatedCompany.webhookSecret).toBeDefined();
      expect(updatedCompany.webhookSecret).not.toBeNull();
    });

    it('should allow admin to reject a KYC submission', async () => {
      // Create a new user and KYC to reject
      const rejectUserEmail = 'kyc-e2e-reject@example.com';
      const rejectUser = await prisma.company.create({
        data: {
          companyName: 'KYC E2E Reject',
          businessEmail: rejectUserEmail,
          password:
            '$2b$10$f/9T8/Y.v1G.N9.Z/Y.v1u.C/Y.v1G.N9.Z/Y.v1u.C/Y.v1G.N9',
          isEmailVerified: true,
          role: Role.USER,
        },
      });
      const kycToReject = await prisma.kycInfo.create({
        data: {
          companyId: rejectUser.id,
          businessRegistrationNo: 'BN-REJECT',
          businessAddress: '123 Reject St',
          contactPersonName: 'Reject User',
          contactPersonPhone: '+254700000003',
          status: KycStatus.PENDING,
        },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/kyc/${kycToReject.id}/review`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ decision: 'REJECT', notes: 'Missing documentation.' })
        .expect(201)
        .then((res) => {
          expect(res.body.status).toEqual(KycStatus.REJECTED);
        });

      const updatedCompany = await prisma.company.findUnique({
        where: { id: rejectUser.id },
      });
      expect(updatedCompany.kycStatus).toEqual(KycStatus.REJECTED);
      expect(updatedCompany.webhookSecret).toBeNull();
    });
  });
});
