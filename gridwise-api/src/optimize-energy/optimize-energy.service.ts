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

@Injectable()
export class OptimizeEnergyService {
  constructor(
    private readonly directiveInterpreterService: DirectiveInterpreterService,
  ) {}

  optimize(
    request: OptimizeEnergyRequestDto,
  ): OptimizeEnergyResponseDto {
    const directiveInterpretation =
      request.operator_notes.map((note, index) =>
        this.directiveInterpreterService.interpret(note, index),
      );

    return {
      scenario_id: request.scenario_id,
      directive_interpretation: directiveInterpretation,
      hourly_plan: [],
      total_grid_kwh: 0,
      total_cost_bdt: 0,
      peak_grid_kwh: 0,
      plan_summary: 'Optimization not implemented yet.',
    };
  }
}