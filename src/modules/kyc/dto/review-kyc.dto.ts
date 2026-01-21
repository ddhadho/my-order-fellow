import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum KycDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewKycDto {
  @ApiProperty({ enum: KycDecision })
  @IsEnum(KycDecision)
  decision: KycDecision;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
