import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async getOrdersByCompany(companyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { companyId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: {
            orderBy: { timestamp: 'desc' },
            take: 1, // Only latest status
          },
        },
      }),
      this.prisma.order.count({ where: { companyId } }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(orderId: string, companyId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        companyId, // Ensure company owns this order
      },
      include: {
        statusHistory: {
          orderBy: { timestamp: 'desc' },
        },
        notifications: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            recipient: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async trackOrderByEmail(email: string, externalOrderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        customerEmail: email,
        externalOrderId,
      },
      include: {
        statusHistory: {
          orderBy: { timestamp: 'desc' },
        },
        company: {
          select: {
            companyName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return {
      orderId: order.externalOrderId,
      currentStatus: order.currentStatus,
      itemSummary: order.itemSummary,
      deliveryAddress: order.deliveryAddress,
      merchant: order.company.companyName,
      createdAt: order.createdAt,
      timeline: order.statusHistory.map((history) => ({
        status: history.status,
        note: history.note,
        timestamp: history.timestamp,
      })),
    };
  }

  async getOrderStats(companyId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.order.count({ where: { companyId } }),
      this.prisma.order.groupBy({
        by: ['currentStatus'],
        where: { companyId },
        _count: true,
      }),
    ]);

    const statusBreakdown = byStatus.reduce(
      (acc, curr) => {
        acc[curr.currentStatus] = {
          count: curr._count,
          percentage:
            total > 0 ? ((curr._count / total) * 100).toFixed(2) : '0',
        };
        return acc;
      },
      {} as Record<string, { count: number; percentage: string }>,
    );

    return {
      total,
      byStatus: statusBreakdown,
    };
  }

  async searchOrders(
    companyId: string,
    filters: {
      externalOrderId?: string;
      customerEmail?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const {
      externalOrderId,
      customerEmail,
      status,
      page = 1,
      limit = 20,
    } = filters;
    const skip = (page - 1) * limit;

    const whereClause: any = { companyId };

    if (externalOrderId) {
      whereClause.externalOrderId = {
        contains: externalOrderId,
        mode: 'insensitive',
      };
    }

    if (customerEmail) {
      whereClause.customerEmail = {
        contains: customerEmail,
        mode: 'insensitive',
      };
    }

    if (status) {
      whereClause.currentStatus = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          statusHistory: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where: whereClause }),
    ]);

    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: {
        externalOrderId,
        customerEmail,
        status,
      },
    };
  }
}
