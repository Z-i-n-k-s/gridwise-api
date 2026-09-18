import { Injectable } from '@nestjs/common';
import {
  OptimizeEnergyRequestDto,
} from './dto/optimize-energy-request.dto.js';
import {
  OptimizeEnergyResponseDto,
} from './dto/optimize-energy-response.dto.js';

@Injectable()
export class OptimizeEnergyService {
  optimize(
    request: OptimizeEnergyRequestDto,
  ): OptimizeEnergyResponseDto {
    return {
      scenario_id: request.scenario_id,
      directive_interpretation: [],
      hourly_plan: [],
      total_grid_kwh: 0,
      total_cost_bdt: 0,
      peak_grid_kwh: 0,
      plan_summary: 'Optimization not implemented yet.',
    };
  }
}