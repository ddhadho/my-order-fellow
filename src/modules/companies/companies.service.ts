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

  async getApiUsageSummary(companyId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total, byEndpoint, byDay] = await Promise.all([
      this.prisma.apiUsageLog.count({
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.apiUsageLog.groupBy({
        by: ['endpoint', 'method'],
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
      }),
      this.prisma.apiUsageLog.groupBy({
        by: ['createdAt'],
        where: { companyId, createdAt: { gte: thirtyDaysAgo } },
        _count: true,
      }),
    ]);

    return {
      period: '30 days',
      totalRequests: total,
      byEndpoint: byEndpoint.map((e) => ({
        endpoint: e.endpoint,
        method: e.method,
        count: e._count,
      })),
      dailyBreakdown: byDay.map((d) => ({
        date: d.createdAt,
        count: d._count,
      })),
    };
  }

  async getApiUsageLogs(companyId: string, limit = 100) {
    return this.prisma.apiUsageLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        endpoint: true,
        method: true,
        statusCode: true,
        createdAt: true,
      },
    });
  }
}
