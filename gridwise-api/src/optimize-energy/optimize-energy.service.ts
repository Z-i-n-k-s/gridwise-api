import { Injectable } from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from './dto/optimize-energy-request.dto.js';

import {
  OptimizeEnergyResponseDto,
} from './dto/optimize-energy-response.dto.js';

import {
  DirectiveInterpreterService,
} from './interpreter/directive-interpreter.service.js';

import {
  DirectiveGuardrailService,
} from './guardrails/directive-guardrail.service.js';

import {
  RequestValidatorService,
} from './validation/request-validator.service.js';

import {
  ConstraintBuilderService,
} from './optimizer/constraint-builder.service.js';

@Injectable()
export class OptimizeEnergyService {
  constructor(
    private readonly directiveInterpreterService:
      DirectiveInterpreterService,

    private readonly directiveGuardrailService:
      DirectiveGuardrailService,

    private readonly requestValidatorService:
      RequestValidatorService,

    private readonly constraintBuilderService:
      ConstraintBuilderService,
  ) {}

  async optimize(
    request: OptimizeEnergyRequestDto,
  ): Promise<OptimizeEnergyResponseDto> {
    this.requestValidatorService.validate(request);

    const interpretedDirectives =
      await this.directiveInterpreterService.interpret(
        request,
      );

    const directiveInterpretation =
      this.directiveGuardrailService.validate(
        request,
        interpretedDirectives,
      );

    const hourlyConstraints =
      this.constraintBuilderService.build(
        request,
        directiveInterpretation,
      );

    // This will be passed to the optimizer next.
    void hourlyConstraints;

    return {
      scenario_id: request.scenario_id,
      directive_interpretation:
        directiveInterpretation,
      hourly_plan: [],
      total_grid_kwh: 0,
      total_cost_bdt: 0,
      peak_grid_kwh: 0,
      plan_summary:
        'Optimization not implemented yet.',
    };
  }
}