import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import type { Company } from '@prisma/client';

@ApiTags('Companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get company profile' })
  getProfile(@GetUser() company: Company) {
    return this.companiesService.getProfile(company.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update company profile' })
  updateProfile(@GetUser() company: Company, @Body() dto: UpdateProfileDto) {
    return this.companiesService.updateProfile(company.id, dto);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete company account' })
  deleteAccount(@GetUser() company: Company) {
    return this.companiesService.deleteAccount(company.id);
  }
}
