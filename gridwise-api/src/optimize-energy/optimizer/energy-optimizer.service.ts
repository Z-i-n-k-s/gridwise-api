import { Injectable } from '@nestjs/common';

import {
  OptimizeEnergyRequestDto,
} from '../dto/optimize-energy-request.dto.js';

import {
  HourlyPlanDto,
} from '../dto/optimize-energy-response.dto.js';

import {
  HourConstraint,
} from './constraint-builder.service.js';

interface HighsColumn {
  Primal: number;
}

interface HighsResult {
  Status: string;
  Columns: Record<string, HighsColumn>;
}

interface HighsInstance {
  solve(
    lp: string,
    options?: Record<string, unknown>,
  ): HighsResult;
}

export interface EnergyOptimizerResult {
  hourly_plan: HourlyPlanDto[];
  total_grid_kwh: number;
  total_cost_bdt: number;
  peak_grid_kwh: number;
}

@Injectable()
export class EnergyOptimizerService {
  private readonly highsPromise =
    this.loadHighs();

  private async loadHighs(): Promise<HighsInstance> {
    const highsModule = await import('highs');

    const loadHighs = highsModule.default as unknown as
      () => Promise<HighsInstance>;

    return loadHighs();
  }

  async optimize(
    request: OptimizeEnergyRequestDto,
    constraints: HourConstraint[],
  ): Promise<EnergyOptimizerResult> {
    const highs = await this.highsPromise;

    const hoursByNumber = new Map(
      request.hours.map((item) => [
        item.hour,
        item,
      ]),
    );

    const objective = request.hours
      .map(
        (hour) =>
          `${hour.tariff_bdt_per_kwh} g${hour.hour}`,
      )
      .join(' + ');

    const equations: string[] = [];

    for (let h = 0; h < 24; h++) {
      const hour = hoursByNumber.get(h);

      if (!hour) {
        throw new Error(
          `Missing hour ${h}`,
        );
      }

      // Energy balance:
      // grid + solar - battery_move = demand
      equations.push(
        `balance_${h}: g${h} + s${h} - b${h} = ${hour.demand_kwh}`,
      );

      // Battery state transition
      if (h === 0) {
        equations.push(
          `battery_${h}: e${h} - b${h} = ${request.battery.initial_energy_kwh}`,
        );
      } else {
        equations.push(
          `battery_${h}: e${h} - e${h - 1} - b${h} = 0`,
        );
      }
    }

    // Final battery energy must equal initial energy
    equations.push(
      `final_battery: e23 = ${request.battery.initial_energy_kwh}`,
    );

    const bounds: string[] = [];

    for (let h = 0; h < 24; h++) {
      const hour = hoursByNumber.get(h);
      const constraint = constraints[h];

      if (!hour || !constraint) {
        throw new Error(
          `Missing data or constraint for hour ${h}`,
        );
      }

      // Grid bounds
      if (constraint.max_grid_kwh === null) {
        bounds.push(
          `g${h} >= 0`,
        );
      } else {
        bounds.push(
          `0 <= g${h} <= ${constraint.max_grid_kwh}`,
        );
      }

      // Effective solar after directives
      const availableSolar =
        hour.solar_kwh *
        constraint.solar_factor;

      bounds.push(
        `0 <= s${h} <= ${availableSolar}`,
      );

      // Battery movement:
      // positive = charging
      // negative = discharging
      let minimumBatteryMove =
        -request.battery
          .max_discharge_kwh_per_hour;

      let maximumBatteryMove =
        request.battery
          .max_charge_kwh_per_hour;

      if (!constraint.can_discharge) {
        minimumBatteryMove = 0;
      }

      if (!constraint.can_charge) {
        maximumBatteryMove = 0;
      }

      bounds.push(
        `${minimumBatteryMove} <= b${h} <= ${maximumBatteryMove}`,
      );

      // Battery energy bounds
      bounds.push(
        `${constraint.minimum_battery_kwh} <= e${h} <= ${request.battery.capacity_kwh}`,
      );
    }

    const lp = `
Minimize
 cost: ${objective}

Subject To
 ${equations.join('\n ')}

Bounds
 ${bounds.join('\n ')}

End
    `.trim();

    const result = highs.solve(lp, {
      output_flag: false,
      presolve: 'on',
    });

    if (result.Status !== 'Optimal') {
      throw new Error(
        `Energy optimization failed: ${result.Status}`,
      );
    }

    const tolerance = 1e-7;

    const hourlyPlan: HourlyPlanDto[] = [];

    for (let h = 0; h < 24; h++) {
      const grid =
        this.getVariableValue(
          result,
          `g${h}`,
        );

      const solar =
        this.getVariableValue(
          result,
          `s${h}`,
        );

      const batteryMove =
        this.getVariableValue(
          result,
          `b${h}`,
        );

      const batteryEnergy =
        this.getVariableValue(
          result,
          `e${h}`,
        );

      let batteryAction:
        | 'charge'
        | 'discharge'
        | 'idle';

      let batteryKwh: number;

      if (batteryMove > tolerance) {
        batteryAction = 'charge';
        batteryKwh = batteryMove;
      } else if (
        batteryMove < -tolerance
      ) {
        batteryAction = 'discharge';
        batteryKwh =
          Math.abs(batteryMove);
      } else {
        batteryAction = 'idle';
        batteryKwh = 0;
      }

      hourlyPlan.push({
        hour: h,

        grid_kwh:
          this.cleanNumber(grid),

        solar_used_kwh:
          this.cleanNumber(solar),

        battery_action:
          batteryAction,

        battery_kwh:
          this.cleanNumber(
            batteryKwh,
          ),

        battery_energy_after_kwh:
          this.cleanNumber(
            batteryEnergy,
          ),
      });
    }

    const totalGrid =
      this.cleanNumber(
        hourlyPlan.reduce(
          (sum, item) =>
            sum + item.grid_kwh,
          0,
        ),
      );

    const totalCost =
      this.cleanNumber(
        hourlyPlan.reduce(
          (sum, item) => {
            const hour =
              hoursByNumber.get(
                item.hour,
              );

            if (!hour) {
              throw new Error(
                `Missing tariff for hour ${item.hour}`,
              );
            }

            return (
              sum +
              item.grid_kwh *
                hour.tariff_bdt_per_kwh
            );
          },
          0,
        ),
      );

    const peakGrid =
      this.cleanNumber(
        Math.max(
          ...hourlyPlan.map(
            (item) =>
              item.grid_kwh,
          ),
        ),
      );

    return {
      hourly_plan:
        hourlyPlan,

      total_grid_kwh:
        totalGrid,

      total_cost_bdt:
        totalCost,

      peak_grid_kwh:
        peakGrid,
    };
  }

  private getVariableValue(
    result: HighsResult,
    variableName: string,
  ): number {
    const variable =
      result.Columns[variableName];

    if (!variable) {
      throw new Error(
        `Optimizer variable not found: ${variableName}`,
      );
    }

    return variable.Primal;
  }

  private cleanNumber(
    value: number,
  ): number {
    if (Math.abs(value) < 1e-7) {
      return 0;
    }

    return Number(
      value.toFixed(6),
    );
  }
}