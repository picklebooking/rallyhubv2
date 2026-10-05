import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { VenuesModule } from './venues/venues.module';
import { CourtsModule } from './courts/courts.module';
import { createAuth } from './auth/auth';
import { getRateLimitThrottlerOptions } from './config/rate-limit.config';
import { DevAuthBypassGuard } from './auth/dev-auth-bypass.guard';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { UsersModule } from './users/users.module';
import { CourtBookModule } from './court-book/court-book.module';
import { TenantModule } from './tenant/tenant.module';

const devAuthBypassEnabled = Boolean(process.env.AUTH_DEV_BYPASS_EMAIL);

if (devAuthBypassEnabled && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AUTH_DEV_BYPASS_EMAIL must never be set when NODE_ENV=production.',
  );
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [getRateLimitThrottlerOptions()],
      }),
    }),
    PrismaModule,
    AuthModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createAuth(prisma.db),
        bodyParser: {
          rawBody: true,
        },
      }),
      disableGlobalAuthGuard: devAuthBypassEnabled,
    }),
    UsersModule,
    VenuesModule,
    CourtsModule,
    CourtBookModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    ...(devAuthBypassEnabled
      ? [{ provide: APP_GUARD, useClass: DevAuthBypassGuard }]
      : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
