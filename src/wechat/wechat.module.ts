import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { WechatController } from './wechat.controller';
import { WechatService } from './wechat.service';
import { WechatSdkService } from './wechat-sdk.service';
import { UserProvider } from './user-provider.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { REDIS_CLIENT } from '../auth/redis.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProvider, User]),
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret)
          throw new Error('JWT_SECRET environment variable is not set');
        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_EXPIRES_IN', '15m'),
          },
        };
      },
    }),
  ],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (url) return new Redis(url);
        return new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        });
      },
    },
    WechatService,
    WechatSdkService,
  ],
  controllers: [WechatController],
  exports: [WechatService],
})
export class WechatModule {}
