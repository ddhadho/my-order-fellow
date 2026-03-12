import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyWebhookSignature } from '../utils/webhook-signature.util';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { [key: string]: string | string[] };
      body: unknown;
      rawBody?: Buffer;
      companyId?: string;
    }>();

    const signature = request.headers['x-webhook-signature'];
    const companyId = request.headers['x-company-id'];

    if (!signature || Array.isArray(signature)) {
      throw new UnauthorizedException(
        'Missing or invalid X-Webhook-Signature header',
      );
    }

    if (!companyId || Array.isArray(companyId)) {
      throw new UnauthorizedException('Missing or invalid X-Company-Id header');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        isWebhookActive: true,
        kycStatus: true,
        webhookSecret: true,
      },
    });

    if (!company || !company.webhookSecret) {
      throw new UnauthorizedException('Invalid company');
    }

    if (!company.isWebhookActive) {
      throw new UnauthorizedException('Webhook is not active');
    }

    if (company.kycStatus !== 'APPROVED') {
      throw new UnauthorizedException('Company KYC not approved');
    }

    const payload = JSON.stringify(request.body);

    const isValid = verifyWebhookSignature(
      payload,
      company.webhookSecret,
      signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    request.companyId = company.id;
    return true;
  }
}
