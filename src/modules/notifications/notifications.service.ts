import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async sendTrackingActivatedNotification(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return;

    const html = this.emailService.generateTrackingActivatedEmail(order);
    const result = await this.emailService.sendEmail(
      order.customerEmail,
      `Order ${order.externalOrderId} - Tracking Activated`,
      html,
    );

    // Log notification
    await this.prisma.notification.create({
      data: {
        orderId,
        type: 'TRACKING_ACTIVATED',
        recipient: order.customerEmail,
        subject: `Order ${order.externalOrderId} - Tracking Activated`,
        body: html,
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        errorMsg: result.error || null,
      },
    });
  }

  async sendStatusUpdateNotification(
    orderId: string,
    newStatus: string,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) return;

    const html = this.emailService.generateStatusUpdateEmail(
      order,
      newStatus,
      note,
    );
    const result = await this.emailService.sendEmail(
      order.customerEmail,
      `Order ${order.externalOrderId} - Status Update`,
      html,
    );

    await this.prisma.notification.create({
      data: {
        orderId,
        type: 'STATUS_UPDATE',
        recipient: order.customerEmail,
        subject: `Order ${order.externalOrderId} - Status Update`,
        body: html,
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        errorMsg: result.error || null,
      },
    });
  }

  async retryFailedNotifications() {
    const failed = await this.prisma.notification.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      include: {
        order: true,
      },
    });

    console.log(`Retrying ${failed.length} failed notifications...`);

    for (const notification of failed) {
      const result = await this.emailService.sendEmail(
        notification.recipient,
        notification.subject,
        notification.body,
      );

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: result.success ? 'SENT' : 'FAILED',
          sentAt: result.success ? new Date() : null,
          failedAt: result.success ? null : new Date(),
          errorMsg: result.error || null,
        },
      });
    }

    const successCount = failed.filter((n) => n.status === 'SENT').length;
    console.log(
      `Successfully retried ${successCount}/${failed.length} notifications`,
    );
  }
}
