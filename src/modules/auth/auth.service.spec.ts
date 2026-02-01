import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service'; // Keep original import for type hinting
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockJwtService = {
    sign: jest.fn(),
  };

    const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)), // Mock transaction for `auth.service.ts`
    // Add other Prisma models and methods as needed for mocking
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService, // Provide mock PrismaService
          useValue: mockPrismaService,
        },
        {
          provide: JwtService, // Provide mock JwtService
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService); // Get the mocked PrismaService
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      companyName: 'Test Company',
      businessEmail: 'test@company.com',
      password: 'SecurePass123!',
    };

    it('should register a new company successfully', async () => {
      const hashedPassword = 'hashed_password';
      const mockCompany = {
        id: 'company-123',
        companyName: 'Test Company',
        businessEmail: 'test@company.com',
        password: hashedPassword,
        emailOtp: '123456',
        emailOtpExpiresAt: expect.any(Date),
        isEmailVerified: false,
      };

      // Mock PrismaService methods that AuthService calls
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(hashedPassword);
      jest.spyOn(prisma.company, 'create').mockResolvedValue(mockCompany);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        message: 'Registration successful. Please verify your email.',
        companyId: 'company-123',
      });

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { businessEmail: 'test@company.com' },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!', 10);

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyName: 'Test Company',
          businessEmail: 'test@company.com',
          password: hashedPassword,
          emailOtp: expect.any(String),
          emailOtpExpiresAt: expect.any(Date),
        }),
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'existing-company',
        businessEmail: 'test@company.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Email already registered',
      );

      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it('should generate 6-digit OTP', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');

      let capturedOtp: string;
      jest.spyOn(prisma.company, 'create').mockImplementation((data) => {
        capturedOtp = data.data.emailOtp;
        return Promise.resolve({ id: '123', ...data.data });
      });

      await service.register(registerDto);

      expect(capturedOtp).toMatch(/^\d{6}$/); // 6 digits
      expect(parseInt(capturedOtp)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(capturedOtp)).toBeLessThanOrEqual(999999);
    });

    it('should set OTP expiry to 10 minutes from now', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');

      let capturedExpiry: Date;
      jest.spyOn(prisma.company, 'create').mockImplementation((data) => {
        capturedExpiry = data.data.emailOtpExpiresAt;
        return Promise.resolve({ id: '123', ...data.data });
      });

      const beforeTime = new Date(Date.now() + 9 * 60 * 1000); // 9 min
      await service.register(registerDto);
      const afterTime = new Date(Date.now() + 11 * 60 * 1000); // 11 min

      expect(capturedExpiry.getTime()).toBeGreaterThan(beforeTime.getTime());
      expect(capturedExpiry.getTime()).toBeLessThan(afterTime.getTime());
    });
  });

  describe('verifyOtp', () => {
    const verifyOtpDto = {
      businessEmail: 'test@company.com',
      otp: '123456',
    };

    it('should verify OTP successfully', async () => {
      const mockCompany = {
        id: 'company-123',
        businessEmail: 'test@company.com',
        isEmailVerified: false,
        emailOtp: '123456',
        emailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // Future
      };

      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(mockCompany);
      jest.spyOn(prisma.company, 'update').mockResolvedValue({
        ...mockCompany,
        isEmailVerified: true,
      });

      const result = await service.verifyOtp(verifyOtpDto);

      expect(result).toEqual({
        message: 'Email verified successfully',
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: 'company-123' },
        data: {
          isEmailVerified: true,
          emailOtp: null,
          emailOtpExpiresAt: null,
        },
      });
    });

    it('should throw UnauthorizedException if company not found', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(null);

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw BadRequestException if email already verified', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'company-123',
        isEmailVerified: true,
      });

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        'Email already verified',
      );
    });

    it('should throw UnauthorizedException if OTP is invalid', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'company-123',
        isEmailVerified: false,
        emailOtp: '123456',
        emailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await expect(
        service.verifyOtp({
          businessEmail: 'test@company.com',
          otp: '999999', // Wrong OTP
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyOtp({
          businessEmail: 'test@company.com',
          otp: '999999',
        }),
      ).rejects.toThrow('Invalid OTP');
    });

    it('should throw UnauthorizedException if OTP is expired', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'company-123',
        isEmailVerified: false,
        emailOtp: '123456',
        emailOtpExpiresAt: new Date(Date.now() - 1000), // Past
      });

      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyOtp(verifyOtpDto)).rejects.toThrow(
        'OTP expired',
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      businessEmail: 'test@company.com',
      password: 'SecurePass123!',
    };

    it('should login successfully and return JWT token', async () => {
      const mockCompany = {
        id: 'company-123',
        companyName: 'Test Company',
        businessEmail: 'test@company.com',
        password: 'hashed_password',
        isEmailVerified: true,
        kycStatus: 'PENDING',
      };

      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(mockCompany);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token-123');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token-123',
        company: {
          id: 'company-123',
          companyName: 'Test Company',
          email: 'test@company.com',
          kycStatus: 'PENDING',
        },
      });

      expect(prisma.company.findUnique).toHaveBeenCalledWith({
        where: { businessEmail: 'test@company.com' },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'SecurePass123!',
        'hashed_password',
      );

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'company-123',
        email: 'test@company.com',
      });
    });

    it('should throw UnauthorizedException if company not found', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'company-123',
        password: 'hashed_password',
        isEmailVerified: true,
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      jest.spyOn(prisma.company, 'findUnique').mockResolvedValue({
        id: 'company-123',
        password: 'hashed_password',
        isEmailVerified: false,
      });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Please verify your email first',
      );
    });
  });
});
