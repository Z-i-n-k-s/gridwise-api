import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from './dto/optimize-energy-request.dto.js';

import {
  OptimizeEnergyService,
} from './optimize-energy.service.js';

@Controller('optimize-energy')
export class OptimizeEnergyController {
  constructor(
    private readonly optimizeEnergyService:
      OptimizeEnergyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  optimize(
    @Body() request: OptimizeEnergyRequestDto,
  ) {
    return this.optimizeEnergyService.optimize(
      request,
    );
  }
}