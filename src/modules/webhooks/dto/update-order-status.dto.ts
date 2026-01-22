import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrderStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'ORD-12345' })
  @IsNotEmpty()
  @IsString()
  externalOrderId: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  newStatus: OrderStatus;

  @ApiPropertyOptional({ example: 'Package arrived at Lagos hub' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
