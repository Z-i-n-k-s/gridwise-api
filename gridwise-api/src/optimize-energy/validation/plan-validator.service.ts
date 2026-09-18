import { Injectable } from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from '../dto/optimize-energy-request.dto.js';

import {
  HourConstraint,
} from '../optimizer/constraint-builder.service.js';

import {
  EnergyOptimizerResult,
} from '../optimizer/energy-optimizer.service.js';

@Injectable()
export class PlanValidatorService {
  private readonly tolerance = 0.01;

  validate(
    request: OptimizeEnergyRequestDto,
    constraints: HourConstraint[],
    result: EnergyOptimizerResult,
  ): void {
    const plan = result.hourly_plan;

    if (plan.length !== 24) {
      throw new Error(
        'Optimized plan must contain exactly 24 hours',
      );
    }

    const hoursByNumber = new Map(
      request.hours.map((hour) => [
        hour.hour,
        hour,
      ]),
    );

    let previousBatteryEnergy =
      request.battery.initial_energy_kwh;

    for (let h = 0; h < 24; h++) {
      const planHour = plan[h];
      const inputHour = hoursByNumber.get(h);
      const constraint = constraints[h];

      if (!planHour || planHour.hour !== h) {
        throw new Error(
          `Invalid hourly plan entry for hour ${h}`,
        );
      }

      if (!inputHour || !constraint) {
        throw new Error(
          `Missing input or constraint for hour ${h}`,
        );
      }

      this.validateFiniteValues(planHour, h);

      const effectiveSolar =
        inputHour.solar_kwh *
        constraint.solar_factor;

      if (
        planHour.solar_used_kwh <
          -this.tolerance ||
        planHour.solar_used_kwh >
          effectiveSolar + this.tolerance
      ) {
        throw new Error(
          `Invalid solar usage at hour ${h}`,
        );
      }

      if (
        planHour.grid_kwh <
        -this.tolerance
      ) {
        throw new Error(
          `Negative grid usage at hour ${h}`,
        );
      }

      if (
        constraint.max_grid_kwh !== null &&
        planHour.grid_kwh >
          constraint.max_grid_kwh +
            this.tolerance
      ) {
        throw new Error(
          `Grid limit violated at hour ${h}`,
        );
      }

      if (
        planHour.battery_kwh <
        -this.tolerance
      ) {
        throw new Error(
          `Negative battery_kwh at hour ${h}`,
        );
      }

      let signedBatteryMove = 0;

      switch (planHour.battery_action) {
        case 'charge':
          if (!constraint.can_charge) {
            throw new Error(
              `Charging prohibited at hour ${h}`,
            );
          }

          if (
            planHour.battery_kwh >
            request.battery
              .max_charge_kwh_per_hour +
              this.tolerance
          ) {
            throw new Error(
              `Charge rate exceeded at hour ${h}`,
            );
          }

          signedBatteryMove =
            planHour.battery_kwh;
          break;

        case 'discharge':
          if (!constraint.can_discharge) {
            throw new Error(
              `Discharging prohibited at hour ${h}`,
            );
          }

          if (
            planHour.battery_kwh >
            request.battery
              .max_discharge_kwh_per_hour +
              this.tolerance
          ) {
            throw new Error(
              `Discharge rate exceeded at hour ${h}`,
            );
          }

          signedBatteryMove =
            -planHour.battery_kwh;
          break;

        case 'idle':
          if (
            Math.abs(planHour.battery_kwh) >
            this.tolerance
          ) {
            throw new Error(
              `Idle battery must have zero battery_kwh at hour ${h}`,
            );
          }

          signedBatteryMove = 0;
          break;

        default:
          throw new Error(
            `Invalid battery action at hour ${h}`,
          );
      }

      const expectedBatteryEnergy =
        previousBatteryEnergy +
        signedBatteryMove;

      if (
        !this.nearlyEqual(
          planHour.battery_energy_after_kwh,
          expectedBatteryEnergy,
        )
      ) {
        throw new Error(
          `Battery transition invalid at hour ${h}`,
        );
      }

      if (
        planHour.battery_energy_after_kwh <
          constraint.minimum_battery_kwh -
            this.tolerance
      ) {
        throw new Error(
          `Minimum battery reserve violated at hour ${h}`,
        );
      }

      if (
        planHour.battery_energy_after_kwh >
          request.battery.capacity_kwh +
            this.tolerance
      ) {
        throw new Error(
          `Battery capacity exceeded at hour ${h}`,
        );
      }

      const batteryDischarge =
        planHour.battery_action ===
        'discharge'
          ? planHour.battery_kwh
          : 0;

      const batteryCharge =
        planHour.battery_action ===
        'charge'
          ? planHour.battery_kwh
          : 0;

      const leftSide =
        planHour.grid_kwh +
        planHour.solar_used_kwh +
        batteryDischarge;

      const rightSide =
        inputHour.demand_kwh +
        batteryCharge;

      if (
        !this.nearlyEqual(
          leftSide,
          rightSide,
        )
      ) {
        throw new Error(
          `Energy balance violated at hour ${h}`,
        );
      }

      previousBatteryEnergy =
        planHour.battery_energy_after_kwh;
    }

    if (
      !this.nearlyEqual(
        previousBatteryEnergy,
        request.battery.initial_energy_kwh,
      )
    ) {
      throw new Error(
        'Final battery energy must equal initial battery energy',
      );
    }

    const calculatedGrid =
      plan.reduce(
        (sum, hour) =>
          sum + hour.grid_kwh,
        0,
      );

    if (
      !this.nearlyEqual(
        calculatedGrid,
        result.total_grid_kwh,
      )
    ) {
      throw new Error(
        'total_grid_kwh is inconsistent with hourly plan',
      );
    }

    const calculatedCost =
      plan.reduce((sum, hour) => {
        const input =
          hoursByNumber.get(hour.hour);

        if (!input) {
          throw new Error(
            `Missing tariff for hour ${hour.hour}`,
          );
        }

        return (
          sum +
          hour.grid_kwh *
            input.tariff_bdt_per_kwh
        );
      }, 0);

    if (
      !this.nearlyEqual(
        calculatedCost,
        result.total_cost_bdt,
      )
    ) {
      throw new Error(
        'total_cost_bdt is inconsistent with hourly plan',
      );
    }

    const calculatedPeak =
      Math.max(
        ...plan.map(
          (hour) => hour.grid_kwh,
        ),
      );

    if (
      !this.nearlyEqual(
        calculatedPeak,
        result.peak_grid_kwh,
      )
    ) {
      throw new Error(
        'peak_grid_kwh is inconsistent with hourly plan',
      );
    }
  }

  private validateFiniteValues(
    hour: {
      grid_kwh: number;
      solar_used_kwh: number;
      battery_kwh: number;
      battery_energy_after_kwh: number;
    },
    hourNumber: number,
  ): void {
    const values = [
      hour.grid_kwh,
      hour.solar_used_kwh,
      hour.battery_kwh,
      hour.battery_energy_after_kwh,
    ];

    if (
      values.some(
        (value) =>
          !Number.isFinite(value),
      )
    ) {
      throw new Error(
        `Non-finite value found at hour ${hourNumber}`,
      );
    }
  }

  private nearlyEqual(
    a: number,
    b: number,
  ): boolean {
    return (
      Math.abs(a - b) <=
      this.tolerance
    );
  }
}