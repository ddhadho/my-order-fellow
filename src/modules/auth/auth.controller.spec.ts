import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  // Mock JwtService for AuthService
  const mockJwtService = {
    sign: jest.fn(),
  };

  // Mock PrismaService for AuthService
  const mockPrismaService = {
    company: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ jwt: { secret: 'test' } })],
        }), // Provide a mock ConfigModule
      ],
      controllers: [AuthController],
      providers: [
        AuthService, // Provide AuthService
        {
          provide: JwtService, // Mock JwtService for AuthService
          useValue: mockJwtService,
        },
        {
          provide: PrismaService, // Provide mock PrismaService for AuthService
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
