import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhooksService } from './webhooks.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { WebhookAuthGuard } from '../../common/guards/webhook-auth.guard';
import { CompanyId } from '../../common/decorators/company-id.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(WebhookAuthGuard) // All webhook endpoints require authentication
@ApiSecurity('webhook-secret') // Shows in Swagger that X-Webhook-Secret is required
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('order-received')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute per company
  @ApiOperation({
    summary: 'Receive new order from e-commerce platform',
    description:
      'Webhook endpoint for e-commerce companies to submit new orders for tracking',
  })
  @ApiResponse({
    status: 200,
    description: 'Order received and tracking activated',
  })
  @ApiResponse({ status: 401, description: 'Invalid webhook credentials' })
  @ApiResponse({ status: 409, description: 'Order already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async receiveOrder(
    @CompanyId() companyId: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.webhooksService.processOrderWebhook(companyId, createOrderDto);
  }

  @Post('status-update')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 200, ttl: 60000 } }) // 200 requests per minute (status updates are more frequent)
  @ApiOperation({
    summary: 'Update order tracking status',
    description:
      'Webhook endpoint for e-commerce companies to send status updates',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook credentials' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async updateStatus(
    @CompanyId() companyId: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ) {
    return this.webhooksService.processStatusUpdateWebhook(
      companyId,
      updateStatusDto,
    );
  }
}
