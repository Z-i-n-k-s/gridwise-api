import { Injectable } from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from '../dto/optimize-energy-request.dto.js';

import {
  InterpretedDirective,
} from '../interpreter/directive-interpreter.types.js';

export interface HourConstraint {
  hour: number;
  solar_factor: number;
  minimum_battery_kwh: number;
  can_charge: boolean;
  can_discharge: boolean;
  max_grid_kwh: number | null;
}

@Injectable()
export class ConstraintBuilderService {
  build(
    request: OptimizeEnergyRequestDto,
    directives: InterpretedDirective[],
  ): HourConstraint[] {
    const constraints: HourConstraint[] =
      Array.from({ length: 24 }, (_, hour) => ({
        hour,
        solar_factor: 1,
        minimum_battery_kwh:
          request.battery.minimum_energy_kwh,
        can_charge: true,
        can_discharge: true,
        max_grid_kwh: null,
      }));

    for (const directive of directives) {
      if (
        !directive.applies ||
        directive.directive_type === 'no_op' ||
        !directive.structured_adjustment
      ) {
        continue;
      }

      const adjustment =
        directive.structured_adjustment;

      const hours = adjustment.hours ?? [];

      switch (directive.directive_type) {
        case 'solar_reduction': {
          const factor = adjustment.factor;

          if (factor === undefined) {
            throw new Error(
              'solar_reduction missing factor',
            );
          }

          for (const hour of hours) {
            constraints[hour].solar_factor =
              Math.min(
                constraints[hour].solar_factor,
                factor,
              );
          }

          break;
        }

        case 'minimum_battery_reserve': {
          const minimumEnergy =
            adjustment.minimum_energy_kwh;

          if (minimumEnergy === undefined) {
            throw new Error(
              'minimum_battery_reserve missing minimum_energy_kwh',
            );
          }

          for (const hour of hours) {
            constraints[hour].minimum_battery_kwh =
              Math.max(
                constraints[hour]
                  .minimum_battery_kwh,
                minimumEnergy,
              );
          }

          break;
        }

        case 'no_charge_window': {
          for (const hour of hours) {
            constraints[hour].can_charge = false;
          }

          break;
        }

        case 'no_discharge_window': {
          for (const hour of hours) {
            constraints[hour].can_discharge = false;
          }

          break;
        }

        case 'max_grid_window': {
          const maxGrid =
            adjustment.max_grid_kwh;

          if (maxGrid === undefined) {
            throw new Error(
              'max_grid_window missing max_grid_kwh',
            );
          }

          for (const hour of hours) {
            const current =
              constraints[hour].max_grid_kwh;

            constraints[hour].max_grid_kwh =
              current === null
                ? maxGrid
                : Math.min(current, maxGrid);
          }

          break;
        }
      }
    }

    return constraints;
  }
}