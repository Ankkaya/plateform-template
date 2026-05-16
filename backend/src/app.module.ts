import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './domains/auth/auth.module';
import { DictionariesModule } from './domains/dictionaries/dictionaries.module';
import { MenusModule } from './domains/menus/menus.module';
import { RolesModule } from './domains/roles/roles.module';
import { SystemLogsModule } from './domains/system-logs/system-logs.module';
import { SystemSettingsModule } from './domains/system-settings/system-settings.module';
import { UploadRecordsModule } from './domains/upload-records/upload-records.module';
import { UsersModule } from './domains/users/users.module';
import { IconAssetsModule } from './infrastructure/icon-assets/icon-assets.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MinioModule,
    IconAssetsModule,
    AuthModule,
    DictionariesModule,
    UsersModule,
    RolesModule,
    MenusModule,
    SystemSettingsModule,
    SystemLogsModule,
    UploadRecordsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
