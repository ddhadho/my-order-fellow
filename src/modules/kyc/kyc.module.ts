import { Module } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { EmailService } from '../../common/services/email.service'; // Added

@Module({
  providers: [KycService, EmailService], // Added EmailService
  controllers: [KycController],
})
export class KycModule {}
