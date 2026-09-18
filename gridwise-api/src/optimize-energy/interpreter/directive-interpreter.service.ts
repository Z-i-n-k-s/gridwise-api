import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { OptimizeEnergyRequestDto } from '../dto/optimize-energy-request.dto.js';
import { GroqClientService } from './groq-client.service.js';

import {
  DirectiveType,
  InterpretedDirective,
} from './directive-interpreter.types.js';

interface RawAdjustment {
  hours: number[];
  factor: number | null;
  minimum_energy_kwh: number | null;
  max_grid_kwh: number | null;
}

interface RawDirective {
  note_index: number;
  applies: boolean;
  directive_type: DirectiveType;
  structured_adjustment: RawAdjustment | null;
  explanation: string;
}

interface GroqDirectiveResponse {
  directives: RawDirective[];
}

@Injectable()
export class DirectiveInterpreterService {
  private readonly logger =
    new Logger(DirectiveInterpreterService.name);

  constructor(
    private readonly groqClientService: GroqClientService,
  ) {}

  async interpret(
    request: OptimizeEnergyRequestDto,
  ): Promise<InterpretedDirective[]> {
    try {
      const client =
        this.groqClientService.getClient();

      const model =
        this.groqClientService.getModel();

      const response =
        await client.chat.completions.create({
          model,

          temperature: 0,
          reasoning_effort: 'low',
          include_reasoning: false,
          max_completion_tokens: 700,

          messages: [
            {
              role: 'system',
              content: `
You interpret natural-language operator notes for a 24-hour campus energy optimization system.

Return exactly one directive for every operator note.

SUPPORTED DIRECTIVES

1. solar_reduction

Use when usable solar is reduced during specific hours.

factor means the fraction of forecast solar that remains usable.

Examples:
- "solar is reduced by 80%" -> factor = 0.2
- "solar remains at 25%" -> factor = 0.25
- "about half of solar remains" -> factor = 0.5

Required values:
hours
factor

2. minimum_battery_reserve

Use when a minimum amount of battery energy must remain stored.

Required values:
hours
minimum_energy_kwh

If the note gives a percentage of battery capacity,
convert it to absolute kWh using battery.capacity_kwh.

Example:
battery capacity = 200 kWh
50% reserve = 100 kWh

3. no_charge_window

Use when battery charging is prohibited.

Required values:
hours

4. no_discharge_window

Use when battery discharging is prohibited.

Required values:
hours

5. max_grid_window

Use when grid electricity import must not exceed a value.

Required values:
hours
max_grid_kwh

6. no_op

Use when a note has no effect on today's 24-hour
energy scheduling problem.

RULES

- Produce exactly one directive per operator note.
- note_index starts at 0.
- Preserve the original note order.
- Supported directive -> applies = true.
- no_op -> applies = false.
- no_op -> structured_adjustment = null.
- Other directives must have structured_adjustment.
- Hours must be integers from 0 through 23.
- Hours must be unique and ascending.
- Time ranges are start-inclusive and end-exclusive.

Examples:
- 2 AM until 5 AM -> [2, 3, 4]
- noon until 2 PM -> [12, 13]
- 6 PM until 9 PM -> [18, 19, 20]
- 7 PM until 10 PM -> [19, 20, 21]

For structured_adjustment:
- hours is always required.
- factor is only used by solar_reduction.
- minimum_energy_kwh is only used by minimum_battery_reserve.
- max_grid_kwh is only used by max_grid_window.
- Fields not relevant to the directive must be null.

Understand paraphrases.
Do not invent unsupported directives.

Keep explanation short.
              `.trim(),
            },

            {
              role: 'user',
              content: JSON.stringify({
                operator_notes:
                  request.operator_notes,

                battery: {
                  capacity_kwh:
                    request.battery.capacity_kwh,
                },
              }),
            },
          ],

          response_format: {
            type: 'json_schema',

            json_schema: {
              name: 'gridwise_directives',
              strict: true,

              schema: {
                type: 'object',
                additionalProperties: false,

                properties: {
                  directives: {
                    type: 'array',

                    items: {
                      type: 'object',
                      additionalProperties: false,

                      properties: {
                        note_index: {
                          type: 'integer',
                          minimum: 0,
                          maximum: 2,
                        },

                        applies: {
                          type: 'boolean',
                        },

                        directive_type: {
                          type: 'string',
                          enum: [
                            'solar_reduction',
                            'minimum_battery_reserve',
                            'no_charge_window',
                            'no_discharge_window',
                            'max_grid_window',
                            'no_op',
                          ],
                        },

                        structured_adjustment: {
                          type: [
                            'object',
                            'null',
                          ],

                          properties: {
                            hours: {
                              type: 'array',

                              items: {
                                type: 'integer',
                                minimum: 0,
                                maximum: 23,
                              },
                            },

                            factor: {
                              type: [
                                'number',
                                'null',
                              ],
                            },

                            minimum_energy_kwh: {
                              type: [
                                'number',
                                'null',
                              ],
                            },

                            max_grid_kwh: {
                              type: [
                                'number',
                                'null',
                              ],
                            },
                          },

                          required: [
                            'hours',
                            'factor',
                            'minimum_energy_kwh',
                            'max_grid_kwh',
                          ],

                          additionalProperties:
                            false,
                        },

                        explanation: {
                          type: 'string',
                        },
                      },

                      required: [
                        'note_index',
                        'applies',
                        'directive_type',
                        'structured_adjustment',
                        'explanation',
                      ],
                    },
                  },
                },

                required: [
                  'directives',
                ],
              },
            },
          },
        });

      const content =
        response.choices[0]
          ?.message?.content;

      if (!content) {
        throw new Error(
          'Groq returned an empty response',
        );
      }

      const parsed = JSON.parse(
        content,
      ) as GroqDirectiveResponse;

      if (
        !Array.isArray(
          parsed.directives,
        ) ||
        parsed.directives.length !==
          request.operator_notes.length
      ) {
        throw new Error(
          'Groq returned an incorrect number of directives',
        );
      }

      return parsed.directives.map(
        (directive) =>
          this.normalizeDirective(
            directive,
          ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Groq error';

      this.logger.error(
        `Directive interpretation failed: ${message}`,
      );

      throw new ServiceUnavailableException(
        'Directive interpretation service is temporarily unavailable',
      );
    }
  }

  private normalizeDirective(
    directive: RawDirective,
  ): InterpretedDirective {
    if (
      directive.directive_type ===
      'no_op'
    ) {
      return {
        note_index:
          directive.note_index,

        applies: false,

        directive_type:
          'no_op',

        structured_adjustment:
          null,

        explanation:
          directive.explanation,
      };
    }

    const adjustment =
      directive.structured_adjustment;

    if (!adjustment) {
      throw new Error(
        `Missing structured adjustment for ${directive.directive_type}`,
      );
    }

    switch (
      directive.directive_type
    ) {
      case 'solar_reduction': {
        if (
          adjustment.factor === null
        ) {
          throw new Error(
            'Missing factor for solar_reduction',
          );
        }

        return {
          note_index:
            directive.note_index,

          applies: true,

          directive_type:
            'solar_reduction',

          structured_adjustment: {
            hours:
              adjustment.hours,

            factor:
              adjustment.factor,
          },

          explanation:
            directive.explanation,
        };
      }

      case 'minimum_battery_reserve': {
        if (
          adjustment
            .minimum_energy_kwh ===
          null
        ) {
          throw new Error(
            'Missing minimum_energy_kwh for minimum_battery_reserve',
          );
        }

        return {
          note_index:
            directive.note_index,

          applies: true,

          directive_type:
            'minimum_battery_reserve',

          structured_adjustment: {
            hours:
              adjustment.hours,

            minimum_energy_kwh:
              adjustment
                .minimum_energy_kwh,
          },

          explanation:
            directive.explanation,
        };
      }

      case 'no_charge_window':
        return {
          note_index:
            directive.note_index,

          applies: true,

          directive_type:
            'no_charge_window',

          structured_adjustment: {
            hours:
              adjustment.hours,
          },

          explanation:
            directive.explanation,
        };

      case 'no_discharge_window':
        return {
          note_index:
            directive.note_index,

          applies: true,

          directive_type:
            'no_discharge_window',

          structured_adjustment: {
            hours:
              adjustment.hours,
          },

          explanation:
            directive.explanation,
        };

      case 'max_grid_window': {
        if (
          adjustment.max_grid_kwh ===
          null
        ) {
          throw new Error(
            'Missing max_grid_kwh for max_grid_window',
          );
        }

        return {
          note_index:
            directive.note_index,

          applies: true,

          directive_type:
            'max_grid_window',

          structured_adjustment: {
            hours:
              adjustment.hours,

            max_grid_kwh:
              adjustment
                .max_grid_kwh,
          },

          explanation:
            directive.explanation,
        };
      }
    }
  }
}