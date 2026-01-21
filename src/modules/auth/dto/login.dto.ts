import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  businessEmail: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}
