import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { IconAssetsModule } from '@/infrastructure/icon-assets/icon-assets.module';
import { SaasModule } from '@/domains/saas/saas.module';

@Module({
  imports: [IconAssetsModule, SaasModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
