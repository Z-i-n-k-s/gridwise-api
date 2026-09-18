import { Injectable } from '@nestjs/common';

import { OptimizeEnergyRequestDto } from '../dto/optimize-energy-request.dto.js';

import {
  InterpretedDirective,
  DirectiveType,
} from '../interpreter/directive-interpreter.types.js';

@Injectable()
export class DirectiveGuardrailService {
  private readonly allowedDirectiveTypes: DirectiveType[] = [
    'solar_reduction',
    'minimum_battery_reserve',
    'no_charge_window',
    'no_discharge_window',
    'max_grid_window',
    'no_op',
  ];

  validate(
    request: OptimizeEnergyRequestDto,
    directives: InterpretedDirective[],
  ): InterpretedDirective[] {
    if (directives.length !== request.operator_notes.length) {
      throw new Error(
        'Directive count does not match operator note count',
      );
    }

    directives.forEach((directive, index) => {
      this.validateDirective(
        request,
        directive,
        index,
      );
    });

    return directives;
  }

  private validateDirective(
    request: OptimizeEnergyRequestDto,
    directive: InterpretedDirective,
    expectedIndex: number,
  ): void {
    if (directive.note_index !== expectedIndex) {
      throw new Error(
        `Invalid note_index: expected ${expectedIndex}, got ${directive.note_index}`,
      );
    }

    if (
      !this.allowedDirectiveTypes.includes(
        directive.directive_type,
      )
    ) {
      throw new Error(
        `Unsupported directive type: ${directive.directive_type}`,
      );
    }

    if (directive.directive_type === 'no_op') {
      if (directive.applies !== false) {
        throw new Error(
          'no_op directive must have applies=false',
        );
      }

      if (directive.structured_adjustment !== null) {
        throw new Error(
          'no_op directive must have structured_adjustment=null',
        );
      }

      return;
    }

    if (directive.applies !== true) {
      throw new Error(
        `${directive.directive_type} must have applies=true`,
      );
    }

    if (!directive.structured_adjustment) {
      throw new Error(
        `${directive.directive_type} requires structured_adjustment`,
      );
    }

    const adjustment = directive.structured_adjustment;

    if (!Array.isArray(adjustment.hours)) {
      throw new Error(
        `${directive.directive_type} requires hours`,
      );
    }

    this.validateHours(adjustment.hours);

    switch (directive.directive_type) {
      case 'solar_reduction':
        if (
          typeof adjustment.factor !== 'number' ||
          !Number.isFinite(adjustment.factor) ||
          adjustment.factor < 0 ||
          adjustment.factor > 1
        ) {
          throw new Error(
            'solar_reduction factor must be between 0 and 1',
          );
        }
        break;

      case 'minimum_battery_reserve':
        if (
          typeof adjustment.minimum_energy_kwh !== 'number' ||
          !Number.isFinite(
            adjustment.minimum_energy_kwh,
          ) ||
          adjustment.minimum_energy_kwh < 0 ||
          adjustment.minimum_energy_kwh >
            request.battery.capacity_kwh
        ) {
          throw new Error(
            'minimum_energy_kwh must be between 0 and battery capacity',
          );
        }
        break;

      case 'max_grid_window':
        if (
          typeof adjustment.max_grid_kwh !== 'number' ||
          !Number.isFinite(adjustment.max_grid_kwh) ||
          adjustment.max_grid_kwh < 0
        ) {
          throw new Error(
            'max_grid_kwh must be a non-negative finite number',
          );
        }
        break;

      case 'no_charge_window':
      case 'no_discharge_window':
        break;
    }
  }

  private validateHours(hours: number[]): void {
    for (const hour of hours) {
      if (
        !Number.isInteger(hour) ||
        hour < 0 ||
        hour > 23
      ) {
        throw new Error(
          `Invalid directive hour: ${hour}`,
        );
      }
    }

    const uniqueHours = new Set(hours);

    if (uniqueHours.size !== hours.length) {
      throw new Error(
        'Directive hours must not contain duplicates',
      );
    }

    for (let i = 1; i < hours.length; i++) {
      if (hours[i] <= hours[i - 1]) {
        throw new Error(
          'Directive hours must be in ascending order',
        );
      }
    }
  }
}