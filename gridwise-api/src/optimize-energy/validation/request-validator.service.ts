import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from '../dto/optimize-energy-request.dto.js';

@Injectable()
export class RequestValidatorService {
  validate(
    request: OptimizeEnergyRequestDto,
  ): void {
    this.validateScenarioId(request);
    this.validateOperatorNotes(request);
    this.validateHours(request);
    this.validateBattery(request);
  }

  private validateScenarioId(
    request: OptimizeEnergyRequestDto,
  ): void {
    if (
      typeof request.scenario_id !==
        'string' ||
      !request.scenario_id.trim()
    ) {
      throw new BadRequestException(
        'scenario_id must not be empty',
      );
    }
  }

  private validateOperatorNotes(
    request: OptimizeEnergyRequestDto,
  ): void {
    if (
      !Array.isArray(
        request.operator_notes,
      ) ||
      request.operator_notes.length < 1 ||
      request.operator_notes.length > 3
    ) {
      throw new BadRequestException(
        'operator_notes must contain 1 to 3 notes',
      );
    }

    request.operator_notes.forEach(
      (note, index) => {
        if (
          typeof note !== 'string' ||
          !note.trim()
        ) {
          throw new BadRequestException(
            `operator_notes[${index}] must not be empty`,
          );
        }
      },
    );
  }

  private validateHours(
    request: OptimizeEnergyRequestDto,
  ): void {
    if (
      !Array.isArray(request.hours) ||
      request.hours.length !== 24
    ) {
      throw new BadRequestException(
        'hours must contain exactly 24 entries',
      );
    }

    const hours = request.hours.map(
      (item) => item.hour,
    );

    const uniqueHours =
      new Set(hours);

    if (uniqueHours.size !== 24) {
      throw new BadRequestException(
        'hours must contain each hour from 0 to 23 exactly once',
      );
    }

    const sortedHours =
      [...hours].sort(
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
    const battery =
      request.battery;

    if (!battery) {
      throw new BadRequestException(
        'battery is required',
      );
    }

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