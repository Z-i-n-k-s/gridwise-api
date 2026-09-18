import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from '../dto/optimize-energy-request.dto.js';

@Injectable()
export class RequestValidatorService {
  validate(request: OptimizeEnergyRequestDto): void {
    this.validateScenarioId(request);
    this.validateOperatorNotes(request);
    this.validateHours(request);
    this.validateBattery(request);
  }

  private validateScenarioId(
    request: OptimizeEnergyRequestDto,
  ): void {
    if (!request.scenario_id.trim()) {
      throw new BadRequestException(
        'scenario_id must not be empty',
      );
    }
  }

  private validateOperatorNotes(
    request: OptimizeEnergyRequestDto,
  ): void {
    request.operator_notes.forEach((note, index) => {
      if (!note.trim()) {
        throw new BadRequestException(
          `operator_notes[${index}] must not be empty`,
        );
      }
    });
  }

  private validateHours(
    request: OptimizeEnergyRequestDto,
  ): void {
    const hours = request.hours.map(
      (item) => item.hour,
    );

    const uniqueHours = new Set(hours);

    if (uniqueHours.size !== 24) {
      throw new BadRequestException(
        'hours must contain each hour from 0 to 23 exactly once',
      );
    }

    const sortedHours = [...hours].sort(
      (a, b) => a - b,
    );

    for (let i = 0; i < 24; i++) {
      if (sortedHours[i] !== i) {
        throw new BadRequestException(
          'hours must contain each hour from 0 to 23 exactly once',
        );
      }
    }
  }

  private validateBattery(
    request: OptimizeEnergyRequestDto,
  ): void {
    const battery = request.battery;

    if (
      battery.initial_energy_kwh >
      battery.capacity_kwh
    ) {
      throw new BadRequestException(
        'initial_energy_kwh cannot exceed capacity_kwh',
      );
    }

    if (
      battery.minimum_energy_kwh >
      battery.capacity_kwh
    ) {
      throw new BadRequestException(
        'minimum_energy_kwh cannot exceed capacity_kwh',
      );
    }

    if (
      battery.initial_energy_kwh <
      battery.minimum_energy_kwh
    ) {
      throw new BadRequestException(
        'initial_energy_kwh cannot be below minimum_energy_kwh',
      );
    }
  }
}