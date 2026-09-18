import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { OptimizeEnergyModule } from './optimize-energy/optimize-energy.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Distributed tracing, auto-correlated logs, request/job metrics,
    // error telemetry, alarms, and more.
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'gridwise-api',
    }),

    HealthModule,
    OptimizeEnergyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}