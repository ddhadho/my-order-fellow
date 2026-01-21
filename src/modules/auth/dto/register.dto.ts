import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  businessEmail: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description:
      'Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char',
  })
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password too weak',
  })
  password: string;
}
