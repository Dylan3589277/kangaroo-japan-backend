import { IsEnum, IsOptional, IsUUID, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, PaymentMethod } from '../payment.entity';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: '订单ID' })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({
    description: '支付方式',
    enum: PaymentMethod,
    default: PaymentMethod.STRIPE,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({
    description: '支付渠道 (stripe payment method types)',
    type: [String],
    default: ['card'],
  })
  @IsOptional()
  @IsArray()
  paymentMethodTypes?: string[];

  @ApiPropertyOptional({
    description: '货币类型',
    enum: Currency,
    default: Currency.CNY,
  })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;
}
