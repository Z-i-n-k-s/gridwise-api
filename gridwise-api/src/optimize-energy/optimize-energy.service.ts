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

import {
  EnergyOptimizerService,
} from './optimizer/energy-optimizer.service.js';

import {
  PlanValidatorService,
} from './validation/plan-validator.service.js';

import {
  PlanSummaryService,
} from './summary/plan-summary.service.js';

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

    private readonly energyOptimizerService:
      EnergyOptimizerService,

      private readonly planValidatorService:
  PlanValidatorService,

  private readonly planSummaryService:
  PlanSummaryService,

  ) {}

  async optimize(
    request: OptimizeEnergyRequestDto,
  ): Promise<OptimizeEnergyResponseDto> {
    // Step 1: validate request
    this.requestValidatorService.validate(request);

    // Step 2: interpret operator notes
    const interpretedDirectives =
      await this.directiveInterpreterService.interpret(
        request,
      );

    // Step 3: validate directives
    const directiveInterpretation =
      this.directiveGuardrailService.validate(
        request,
        interpretedDirectives,
      );

    // Step 4: build hourly constraints
    const hourlyConstraints =
      this.constraintBuilderService.build(
        request,
        directiveInterpretation,
      );

    // Step 5: optimize energy schedule
    const optimization =
      await this.energyOptimizerService.optimize(
        request,
        hourlyConstraints,
      );

      this.planValidatorService.validate(
  request,
  hourlyConstraints,
  optimization,
);

const planSummary =
  this.planSummaryService.generate(
    directiveInterpretation,
  );

    return {
      scenario_id: request.scenario_id,

      directive_interpretation:
        directiveInterpretation,

      hourly_plan:
        optimization.hourly_plan,

      total_grid_kwh:
        optimization.total_grid_kwh,

      total_cost_bdt:
        optimization.total_cost_bdt,

      peak_grid_kwh:
        optimization.peak_grid_kwh,

     plan_summary: planSummary,
    };
  }
}