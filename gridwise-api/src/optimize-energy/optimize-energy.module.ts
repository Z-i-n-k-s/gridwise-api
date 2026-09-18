import { Module } from '@nestjs/common';

import { OptimizeEnergyController } from './optimize-energy.controller.js';
import { OptimizeEnergyService } from './optimize-energy.service.js';

import { DirectiveInterpreterService } from './interpreter/directive-interpreter.service.js';
import { GroqClientService } from './interpreter/groq-client.service.js';

import { DirectiveGuardrailService } from './guardrails/directive-guardrail.service.js';

import { RequestValidatorService } from './validation/request-validator.service.js';

import { ConstraintBuilderService } from './optimizer/constraint-builder.service.js';

@Module({
  controllers: [
    OptimizeEnergyController,
  ],

  providers: [
    OptimizeEnergyService,
    DirectiveInterpreterService,
    GroqClientService,
    DirectiveGuardrailService,
    RequestValidatorService,
    ConstraintBuilderService,
  ],
})
export class OptimizeEnergyModule {}