import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { OptimizeEnergyModule } from './optimize-energy/optimize-energy.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    OptimizeEnergyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}