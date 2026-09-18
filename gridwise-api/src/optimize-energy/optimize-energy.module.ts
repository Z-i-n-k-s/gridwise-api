import { Module } from '@nestjs/common';
import { OptimizeEnergyController } from './optimize-energy.controller.js';
import { OptimizeEnergyService } from './optimize-energy.service.js';

@Module({
  controllers: [OptimizeEnergyController],
  providers: [OptimizeEnergyService]
})
export class OptimizeEnergyModule {}
