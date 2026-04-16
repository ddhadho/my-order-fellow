import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ApiUsageInterceptor } from './common/interceptors/api-usage.interceptor';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrismaModule,
    AuthModule,
    KycModule,
    WebhooksModule,
    NotificationsModule,
    OrdersModule,
    CompaniesModule,
    
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiUsageInterceptor,
    },
  ],
})
export class AppModule {}
  