import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitKycDto, ReviewKycDto } from './dto';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async submitKyc(companyId: string, dto: SubmitKycDto) {
    // Check if KYC already exists
    const existing = await this.prisma.kycInfo.findUnique({
      where: { companyId },
    });

    if (existing) {
      throw new BadRequestException('KYC already submitted');
    }

    const kyc = await this.prisma.kycInfo.create({
      data: {
        companyId,
        ...dto,
      },
    });

    return {
      message: 'KYC submitted successfully. Awaiting admin review.',
      kycId: kyc.id,
    };
  }

  async reviewKyc(kycId: string, adminId: string, dto: ReviewKycDto) {
    const kyc = await this.prisma.kycInfo.findUnique({
      where: { id: kycId },
      include: { company: true },
    });

    if (!kyc) {
      throw new NotFoundException('KYC not found');
    }

    const newStatus = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // Update KYC and company status
    await this.prisma.kycInfo.update({
      where: { id: kycId },
      data: {
        reviewedBy: adminId,
        reviewNotes: dto.notes,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.company.update({
      where: { id: kyc.companyId },
      data: { kycStatus: newStatus },
    });

    // If approved, generate webhook secret
    if (newStatus === 'APPROVED') {
      const salt = this.config.get('webhook.secretSalt');
      const secret = crypto
        .createHash('sha256')
        .update(`${kyc.companyId}-${Date.now()}-${salt}`)
        .digest('hex');

      await this.prisma.company.update({
        where: { id: kyc.companyId },
        data: {
          webhookSecret: secret,
          isWebhookActive: true,
        },
      });

      // TODO: Send email with webhook credentials
      console.log(
        `📧 Webhook secret for ${kyc.company.businessEmail}: ${secret}`,
      );
    }

    return {
      message: `KYC ${newStatus.toLowerCase()}`,
      status: newStatus,
    };
  }

  async getPendingKyc() {
    return this.prisma.kycInfo.findMany({
      where: {
        company: { kycStatus: 'PENDING' },
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            businessEmail: true,
          },
        },
      },
    });
  }
}
