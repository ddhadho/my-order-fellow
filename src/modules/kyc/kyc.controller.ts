import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { SubmitKycDto, ReviewKycDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin-auth.guard'; // Import AdminGuard
import { GetUser } from 'src/common/decorators/get-user.decorator';
import type { Company } from '@prisma/client';
import { Role } from '@prisma/client'; // Import Role enum

@ApiTags('KYC')
@Controller('kyc')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private kycService: KycService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit KYC information' })
  submitKyc(@GetUser() company: Company, @Body() dto: SubmitKycDto) {
    return this.kycService.submitKyc(company.id, dto);
  }

  @Get('pending')
  @UseGuards(AdminGuard) // Apply AdminGuard
  @ApiOperation({ summary: 'Get pending KYC submissions (Admin only)' })
  getPending() {
    return this.kycService.getPendingKyc();
  }

  @Post(':kycId/review')
  @UseGuards(AdminGuard) // Apply AdminGuard
  @ApiOperation({ summary: 'Review KYC submission (Admin only)' })
  reviewKyc(
    @Param('kycId') kycId: string,
    @GetUser() admin: Company,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.reviewKyc(kycId, admin.id, dto);
  }
}
