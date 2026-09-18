import { Injectable } from '@nestjs/common';

import {
  InterpretedDirective,
} from '../interpreter/directive-interpreter.types.js';

@Injectable()
export class PlanSummaryService {
  generate(
    directives: InterpretedDirective[],
  ): string {
    const applied = directives.filter(
      (directive) =>
        directive.applies &&
        directive.directive_type !== 'no_op',
    );

    if (applied.length === 0) {
      return (
        'Generated a cost-minimized 24-hour energy schedule ' +
        'using available solar and battery flexibility while ' +
        'returning the battery to its initial energy level.'
      );
    }

    const descriptions = applied.map(
      (directive) =>
        this.describeDirective(directive),
    );

    return (
      `Applied ${descriptions.join(', ')}. ` +
      'The schedule minimizes grid electricity cost while respecting ' +
      'the interpreted constraints and restoring the battery to its ' +
      'initial energy level by the end of the day.'
    );
  }

  private describeDirective(
    directive: InterpretedDirective,
  ): string {
    const adjustment =
      directive.structured_adjustment;

    if (!adjustment) {
      return 'the applicable operator constraint';
    }

    switch (directive.directive_type) {
      case 'solar_reduction':
        return 'the solar availability restriction';

      case 'minimum_battery_reserve':
        return 'the minimum battery reserve requirement';

      case 'no_charge_window':
        return 'the battery no-charge window';

      case 'no_discharge_window':
        return 'the battery no-discharge window';

      case 'max_grid_window':
        return 'the grid import limit';

      case 'no_op':
        return 'the applicable operator constraint';
    }
  }
}