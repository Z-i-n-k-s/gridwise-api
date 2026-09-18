import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from './dto/optimize-energy-request.dto.js';

import {
  OptimizeEnergyResponseDto,
} from './dto/optimize-energy-response.dto.js';

import {
  InterpretedDirective,
} from './interpreter/directive-interpreter.types.js';

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
  private readonly logger =
    new Logger(
      OptimizeEnergyService.name,
    );

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
    this.requestValidatorService.validate(
      request,
    );

    const directiveInterpretation =
      await this.interpretWithRetry(
        request,
      );

    const hourlyConstraints =
      this.constraintBuilderService.build(
        request,
        directiveInterpretation,
      );

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
      scenario_id:
        request.scenario_id,

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

      plan_summary:
        planSummary,
    };
  }

  private async interpretWithRetry(
    request: OptimizeEnergyRequestDto,
  ): Promise<InterpretedDirective[]> {
    const maximumAttempts = 2;

    for (
      let attempt = 1;
      attempt <= maximumAttempts;
      attempt++
    ) {
      try {
        const interpretedDirectives =
          await this.directiveInterpreterService.interpret(
            request,
          );

        return this.directiveGuardrailService.validate(
          request,
          interpretedDirectives,
        );
      } catch {
        if (
          attempt <
          maximumAttempts
        ) {
          this.logger.warn(
            'Directive interpretation failed; retrying once',
          );

          /*
           * Short backoff helps with temporary
           * provider throttling/network errors.
           */
          await this.delay(1000);

          continue;
        }

        this.logger.error(
          'Directive interpretation failed after retry',
        );

        throw new InternalServerErrorException(
          'Directive interpretation failed',
        );
      }
    }

    throw new InternalServerErrorException(
      'Directive interpretation failed',
    );
  }

  private async delay(
    milliseconds: number,
  ): Promise<void> {
    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          milliseconds,
        );
      },
    );
  }
}