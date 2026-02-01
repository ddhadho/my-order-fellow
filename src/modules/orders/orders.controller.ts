import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import type { Company } from '@prisma/client';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all orders for authenticated company' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getOrders(
    @GetUser() company: Company,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getOrdersByCompany(
      company.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order statistics for company' })
  getStats(@GetUser() company: Company) {
    return this.ordersService.getOrderStats(company.id);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search orders with filters' })
  @ApiQuery({ name: 'externalOrderId', required: false, type: String })
  @ApiQuery({ name: 'customerEmail', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchOrders(
    @GetUser() company: Company,
    @Query('externalOrderId') externalOrderId?: string,
    @Query('customerEmail') customerEmail?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.searchOrders(company.id, {
      externalOrderId,
      customerEmail,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('track/:email/:orderId')
  @ApiOperation({
    summary: 'Track order by email and order ID (public endpoint)',
    description: 'Allows customers to track their order without authentication',
  })
  trackOrder(@Param('email') email: string, @Param('orderId') orderId: string) {
    return this.ordersService.trackOrderByEmail(email, orderId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get detailed information for a specific order',
  })
  getOrderById(@Param('id') id: string, @GetUser() company: Company) {
    return this.ordersService.getOrderById(id, company.id);
  }
}
