import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getProfile(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        companyName: true,
        businessEmail: true,
        phoneNumber: true,
        businessAddress: true,
        kycStatus: true,
        isWebhookActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async updateProfile(
    companyId: string,
    dto: {
      companyName?: string;
      phoneNumber?: string;
      businessAddress?: string;
    },
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(dto.companyName && { companyName: dto.companyName }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
        ...(dto.businessAddress !== undefined && {
          businessAddress: dto.businessAddress,
        }),
      },
      select: {
        id: true,
        companyName: true,
        businessEmail: true,
        phoneNumber: true,
        businessAddress: true,
        kycStatus: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async deleteAccount(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    await this.prisma.company.delete({
      where: { id: companyId },
    });

    return { message: 'Account deleted successfully' };
  }
}
