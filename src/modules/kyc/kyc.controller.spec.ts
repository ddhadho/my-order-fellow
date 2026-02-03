import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

describe('KycController', () => {
  let controller: KycController;
  let kycService: KycService;

  const mockKycService = {
    submitKyc: jest.fn(),
    reviewKyc: jest.fn(),
    getPendingKyc: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        {
          provide: KycService,
          useValue: mockKycService,
        },
      ],
    }).compile();

    controller = module.get<KycController>(KycController);
    kycService = module.get<KycService>(KycService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
