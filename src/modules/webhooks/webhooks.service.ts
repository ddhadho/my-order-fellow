import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async processOrderWebhook(companyId: string, orderDto: CreateOrderDto) {
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        companyId_externalOrderId: {
          companyId,
          externalOrderId: orderDto.externalOrderId,
        },
      },
    });

    if (existingOrder) {
      return {
        success: true,
        orderId: existingOrder.id,
        trackingStatus: existingOrder.currentStatus,
        message: 'Order already exists',
      };
    }

    const order = await this.prisma.order.create({
      data: {
        companyId,
        externalOrderId: orderDto.externalOrderId,
        customerEmail: orderDto.customerEmail,
        customerPhone: orderDto.customerPhone,
        itemSummary: orderDto.itemSummary,
        deliveryAddress: orderDto.deliveryAddress,
        currentStatus: orderDto.initialStatus || 'PENDING',
        statusHistory: {
          create: {
            status: orderDto.initialStatus || 'PENDING',
            note: 'Order received and tracking initiated',
          },
        },
      },
    });

    console.log(`Order created: ${order.externalOrderId}`);

    // Record webhook delivery attempt
    await this.recordWebhookDelivery(companyId, 'ORDER_RECEIVED', {
      orderId: order.id,
      externalOrderId: order.externalOrderId,
    });

    this.notifications
      .sendTrackingActivatedNotification(order.id)
      .catch((err) =>
        console.error('Failed to send tracking notification:', err),
      );

    return {
      success: true,
      orderId: order.id,
      trackingStatus: order.currentStatus,
      message: 'Order received and tracking activated',
    };
  }

  async processStatusUpdateWebhook(
    companyId: string,
    updateDto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        companyId,
        externalOrderId: updateDto.externalOrderId,
      },
    });

    if (!order) {
      throw new ConflictException(
        `Order ${updateDto.externalOrderId} not found`,
      );
    }

    if (order.currentStatus === updateDto.newStatus) {
      return {
        success: true,
        message: 'Status unchanged',
        currentStatus: order.currentStatus,
      };
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        currentStatus: updateDto.newStatus,
        statusHistory: {
          create: {
            status: updateDto.newStatus,
            note: updateDto.note,
          },
        },
      },
    });

    console.log(
      `Order ${order.externalOrderId} updated to ${updateDto.newStatus}`,
    );

    // Record webhook delivery attempt
    await this.recordWebhookDelivery(companyId, 'STATUS_UPDATE', {
      orderId: updatedOrder.id,
      externalOrderId: order.externalOrderId,
      newStatus: updateDto.newStatus,
    });

    this.notifications
      .sendStatusUpdateNotification(
        updatedOrder.id,
        updateDto.newStatus,
        updateDto.note,
      )
      .catch((err) =>
        console.error('Failed to send status update notification:', err),
      );

    return {
      success: true,
      orderId: updatedOrder.id,
      previousStatus: order.currentStatus,
      newStatus: updatedOrder.currentStatus,
      message: 'Status updated successfully',
    };
  }

  async recordWebhookDelivery(
    companyId: string,
    event: string,
    payload: object,
  ) {
    return this.prisma.webhookDelivery.create({
      data: {
        companyId,
        event,
        payload: JSON.stringify(payload),
        status: 'DELIVERED',
        attempts: 1,
        deliveredAt: new Date(),
      },
    });
  }

  async retryFailedWebhookDeliveries() {
    const now = new Date();

    const pending = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'FAILED',
        nextRetryAt: { lte: now },
        attempts: { lt: 5 },
      },
    });

    let succeeded = 0;
    let failed = 0;

    for (const delivery of pending) {
      const attempt = delivery.attempts + 1;

      try {
        // Exponential backoff: 2^attempt minutes (2, 4, 8, 16, 32 mins)
        const backoffMinutes = Math.pow(2, attempt);
        const nextRetryAt = new Date(
          now.getTime() + backoffMinutes * 60 * 1000,
        );

        const isLastAttempt = attempt >= delivery.maxAttempts;

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: attempt,
            status: isLastAttempt ? 'EXHAUSTED' : 'FAILED',
            nextRetryAt: isLastAttempt ? null : nextRetryAt,
            deliveredAt: new Date(),
            lastError: null,
          },
        });

        succeeded++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            attempts: attempt,
            lastError: errorMessage,
          },
        });

        failed++;
      }
    }

    return {
      processed: pending.length,
      succeeded,
      failed,
    };
  }

  async getWebhookDeliveries(companyId: string) {
    return this.prisma.webhookDelivery.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
