import {
  IsArray,
  IsString,
  ArrayMinSize,
  ArrayMaxSize,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum OrderStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export class BulkUpdateStatusDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2', 'uuid-3'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  orderIds: string[];

  @ApiProperty({ enum: OrderStatus, example: 'IN_TRANSIT' })
  @IsEnum(OrderStatus)
  newStatus: string;

  @ApiProperty({ example: 'Batch shipment dispatched', required: false })
  @IsString()
  note?: string;
}
