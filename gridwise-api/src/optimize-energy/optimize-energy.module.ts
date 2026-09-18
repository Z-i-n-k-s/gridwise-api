import { Module } from '@nestjs/common';

import { OptimizeEnergyController } from './optimize-energy.controller.js';
import { OptimizeEnergyService } from './optimize-energy.service.js';
import { DirectiveInterpreterService } from './interpreter/directive-interpreter.service.js';

@Module({
  controllers: [OptimizeEnergyController],
  providers: [
    OptimizeEnergyService,
    DirectiveInterpreterService,
  ],
})
export class OptimizeEnergyModule {}