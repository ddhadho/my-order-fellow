import { IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitKycDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  businessRegistrationNo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  businessAddress: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  contactPersonName: string;

  @ApiProperty()
  @IsPhoneNumber()
  contactPersonPhone: string;
}
