import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const webhookSecret = request.headers['x-webhook-secret'];

    if (!webhookSecret) {
      throw new UnauthorizedException('Missing X-Webhook-Secret header');
    }

    try {
      const company = await this.prisma.company.findUnique({
        where: { webhookSecret },
        select: { id: true, isWebhookActive: true, kycStatus: true },
      });

      if (!company) {
        throw new UnauthorizedException('Invalid webhook secret');
      }

      if (!company.isWebhookActive) {
        throw new UnauthorizedException('Webhook is not active');
      }

      if (company.kycStatus !== 'APPROVED') {
        throw new UnauthorizedException('Company KYC not approved');
      }

      request.companyId = company.id;

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid webhook credentials');
    }
  }
}
