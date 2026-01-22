import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum OrderStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export class CreateOrderDto {
  @ApiProperty({ example: 'ORD-12345' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  externalOrderId: string;

  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  @IsNotEmpty()
  customerEmail: string;

  @ApiPropertyOptional({ example: '+254712345678' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({ example: '2x iPhone 15 Pro, 1x AirPods Pro' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  itemSummary: string;

  @ApiProperty({ example: '123 Main Street, Nairobi, Kenya' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  deliveryAddress: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  initialStatus?: OrderStatus;
}
