import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.company.deleteMany({
      where: {
        businessEmail: {
          contains: 'e2e-test',
        },
      },
    });
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new company successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'E2E Test Company',
          businessEmail: 'e2e-test-001@example.com',
          password: 'SecurePass123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('verify your email');
          expect(res.body).toHaveProperty('companyId');
        });
    });

    it('should reject duplicate email', async () => {
      // First registration
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        companyName: 'Test Company',
        businessEmail: 'e2e-test-duplicate@example.com',
        password: 'SecurePass123!',
      });

      // Second registration with same email
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'Another Company',
          businessEmail: 'e2e-test-duplicate@example.com',
          password: 'SecurePass123!',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already registered');
        });
    });

    it('should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'Test Company',
          businessEmail: 'e2e-test-weak@example.com',
          password: 'weak', // Too weak
        })
        .expect(400);
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'Test Company',
          businessEmail: 'not-an-email',
          password: 'SecurePass123!',
        })
        .expect(400);
    });

    it('should reject missing required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'Test Company',
          // Missing businessEmail and password
        })
        .expect(400);
    });
  });

  describe('POST /auth/verify-otp', () => {
    let testEmail: string;
    let testOtp: string;

    beforeEach(async () => {
      testEmail = `e2e-otp-${Date.now()}@example.com`;

      // Register and capture OTP from database
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        companyName: 'OTP Test Company',
        businessEmail: testEmail,
        password: 'SecurePass123!',
      });

      const company = await prisma.company.findUnique({
        where: { businessEmail: testEmail },
      });

      testOtp = company.emailOtp;
    });

    it('should verify OTP successfully', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: testEmail,
          otp: testOtp,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toContain('verified successfully');
        });
    });

    it('should reject invalid OTP', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: testEmail,
          otp: '999999', // Wrong OTP
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid OTP');
        });
    });

    it('should reject verification for non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: 'nonexistent@example.com',
          otp: '123456',
        })
        .expect(401);
    });

    it('should reject already verified email', async () => {
      // Verify once
      await request(app.getHttpServer()).post('/api/v1/auth/verify-otp').send({
        businessEmail: testEmail,
        otp: testOtp,
      });

      // Try to verify again
      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: testEmail,
          otp: testOtp,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('already verified');
        });
    });

    it('should reject expired OTP', async () => {
      // Manually expire the OTP
      await prisma.company.update({
        where: { businessEmail: testEmail },
        data: {
          emailOtpExpiresAt: new Date(Date.now() - 1000), // Past
        },
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: testEmail,
          otp: testOtp,
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('expired');
        });
    });
  });

  describe('POST /auth/login', () => {
    const testEmail = 'e2e-login-test@example.com';
    const testPassword = 'SecurePass123!';

    beforeAll(async () => {
      // Register and verify a test account
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        companyName: 'Login Test Company',
        businessEmail: testEmail,
        password: testPassword,
      });

      const company = await prisma.company.findUnique({
        where: { businessEmail: testEmail },
      });

      await request(app.getHttpServer()).post('/api/v1/auth/verify-otp').send({
        businessEmail: testEmail,
        otp: company.emailOtp,
      });
    });

    it('should login successfully and return JWT token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          businessEmail: testEmail,
          password: testPassword,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('company');
          expect(res.body.company).toHaveProperty('id');
          expect(res.body.company).toHaveProperty('companyName');
          expect(res.body.company).toHaveProperty('email', testEmail);
          expect(res.body.company).toHaveProperty('kycStatus');
        });
    });

    it('should reject login with wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          businessEmail: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid credentials');
        });
    });

    it('should reject login for non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          businessEmail: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });

    it('should reject login if email not verified', async () => {
      const unverifiedEmail = `e2e-unverified-${Date.now()}@example.com`;

      // Register but don't verify
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        companyName: 'Unverified Company',
        businessEmail: unverifiedEmail,
        password: testPassword,
      });

      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          businessEmail: unverifiedEmail,
          password: testPassword,
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('verify your email');
        });
    });
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration → verification → login flow', async () => {
      const email = `e2e-full-flow-${Date.now()}@example.com`;
      const password = 'SecurePass123!';

      // Step 1: Register
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          companyName: 'Full Flow Test Company',
          businessEmail: email,
          password,
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('companyId');

      // Step 2: Get OTP from database (in production, this would be from email)
      const company = await prisma.company.findUnique({
        where: { businessEmail: email },
      });

      expect(company).toBeDefined();
      expect(company.emailOtp).toMatch(/^\d{6}$/);
      expect(company.isEmailVerified).toBe(false);

      // Step 3: Verify OTP
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({
          businessEmail: email,
          otp: company.emailOtp,
        })
        .expect(201);

      // Step 4: Login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          businessEmail: email,
          password,
        })
        .expect(201);

      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(typeof loginResponse.body.accessToken).toBe('string');
      expect(loginResponse.body.accessToken.length).toBeGreaterThan(0);
    });
  });
});
