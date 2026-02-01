import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrdersService = {
    getOrdersByCompany: jest.fn(),
    getOrderById: jest.fn(),
    trackOrderByEmail: jest.fn(),
    getOrderStats: jest.fn(),
    searchOrders: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService); // Get the mocked service
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
