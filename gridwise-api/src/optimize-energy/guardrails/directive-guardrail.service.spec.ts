import { describe, expect, it } from 'vitest';

import { OptimizeEnergyRequestDto } from '../dto/optimize-energy-request.dto.js';
import {
  InterpretedDirective,
} from '../interpreter/directive-interpreter.types.js';
import {
  DirectiveGuardrailService,
} from './directive-guardrail.service.js';

describe(
  'DirectiveGuardrailService',
  () => {
    const service =
      new DirectiveGuardrailService();

    const makeRequest =
      (): OptimizeEnergyRequestDto =>
        ({
          scenario_id: 'TEST',

          operator_notes: [
            'Test note',
          ],

          hours: Array.from(
            { length: 24 },
            (_, hour) => ({
              hour,
              demand_kwh: 100,
              solar_kwh: 20,
              tariff_bdt_per_kwh: 10,
            }),
          ),

          battery: {
            capacity_kwh: 200,
            initial_energy_kwh: 100,
            minimum_energy_kwh: 20,
            max_charge_kwh_per_hour: 50,
            max_discharge_kwh_per_hour: 50,
          },
        }) as OptimizeEnergyRequestDto;

    const makeDirective =
      (): InterpretedDirective => ({
        note_index: 0,
        applies: true,

        directive_type:
          'solar_reduction',

        structured_adjustment: {
          hours: [12, 13],
          factor: 0.5,
        },

        explanation:
          'Solar reduced.',
      });

    it(
      'accepts valid directive',
      () => {
        const request =
          makeRequest();

        const directives = [
          makeDirective(),
        ];

        expect(
          service.validate(
            request,
            directives,
          ),
        ).toEqual(directives);
      },
    );

    it(
      'rejects incorrect directive count',
      () => {
        const request =
          makeRequest();

        expect(() =>
          service.validate(
            request,
            [],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects wrong note_index',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive.note_index = 1;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects no_op with applies=true',
      () => {
        const request =
          makeRequest();

        const directive:
          InterpretedDirective = {
          note_index: 0,

          applies: true,

          directive_type:
            'no_op',

          structured_adjustment:
            null,

          explanation:
            'Irrelevant.',
        };

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects no_op with adjustment',
      () => {
        const request =
          makeRequest();

        const directive =
          {
            note_index: 0,
            applies: false,
            directive_type:
              'no_op',

            structured_adjustment: {
              hours: [],
            },

            explanation:
              'Irrelevant.',
          } as InterpretedDirective;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects non-no_op with applies=false',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive.applies = false;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects missing structured adjustment',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive.structured_adjustment =
          null;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects duplicate hours',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive
          .structured_adjustment!
          .hours = [12, 12];

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects unsorted hours',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive
          .structured_adjustment!
          .hours = [13, 12];

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects hour outside 0-23',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive
          .structured_adjustment!
          .hours = [24];

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects negative solar factor',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive
          .structured_adjustment!
          .factor = -0.1;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects solar factor above 1',
      () => {
        const request =
          makeRequest();

        const directive =
          makeDirective();

        directive
          .structured_adjustment!
          .factor = 1.1;

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects battery reserve above capacity',
      () => {
        const request =
          makeRequest();

        const directive:
          InterpretedDirective = {
          note_index: 0,
          applies: true,

          directive_type:
            'minimum_battery_reserve',

          structured_adjustment: {
            hours: [18, 19],
            minimum_energy_kwh:
              201,
          },

          explanation:
            'Reserve required.',
        };

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects negative battery reserve',
      () => {
        const request =
          makeRequest();

        const directive:
          InterpretedDirective = {
          note_index: 0,
          applies: true,

          directive_type:
            'minimum_battery_reserve',

          structured_adjustment: {
            hours: [18],
            minimum_energy_kwh:
              -1,
          },

          explanation:
            'Reserve required.',
        };

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'rejects negative grid cap',
      () => {
        const request =
          makeRequest();

        const directive:
          InterpretedDirective = {
          note_index: 0,
          applies: true,

          directive_type:
            'max_grid_window',

          structured_adjustment: {
            hours: [19, 20],
            max_grid_kwh: -1,
          },

          explanation:
            'Grid capped.',
        };

        expect(() =>
          service.validate(
            request,
            [directive],
          ),
        ).toThrow();
      },
    );

    it(
      'accepts valid no_op',
      () => {
        const request =
          makeRequest();

        const directive:
          InterpretedDirective = {
          note_index: 0,
          applies: false,

          directive_type:
            'no_op',

          structured_adjustment:
            null,

          explanation:
            'Not relevant.',
        };

        expect(
          service.validate(
            request,
            [directive],
          ),
        ).toEqual([
          directive,
        ]);
      },
    );
  },
);