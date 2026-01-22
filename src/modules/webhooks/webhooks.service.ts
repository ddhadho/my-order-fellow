import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async processOrderWebhook(companyId: string, orderDto: CreateOrderDto) {
    // Check for duplicate order (idempotency)
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        companyId_externalOrderId: {
          companyId,
          externalOrderId: orderDto.externalOrderId,
        },
      },
    });

    if (existingOrder) {
      // Return existing order (idempotent response)
      return {
        success: true,
        orderId: existingOrder.id,
        trackingStatus: existingOrder.currentStatus,
        message: 'Order already exists',
      };
    }

    // Create order with initial status
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

    console.log(`✅ Order created: ${order.externalOrderId}`);

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

    // Don't update if status hasn't changed
    if (order.currentStatus === updateDto.newStatus) {
      return {
        success: true,
        message: 'Status unchanged',
        currentStatus: order.currentStatus,
      };
    }

    // Update order status and create history entry
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
      `✅ Order ${order.externalOrderId} updated to ${updateDto.newStatus}`,
    );

    return {
      success: true,
      orderId: updatedOrder.id,
      previousStatus: order.currentStatus,
      newStatus: updatedOrder.currentStatus,
      message: 'Status updated successfully',
    };
  }
}
