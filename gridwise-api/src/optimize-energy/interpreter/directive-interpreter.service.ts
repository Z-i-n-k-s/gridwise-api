import {
  Injectable,
  InternalServerErrorException,
  Logger,
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

export class DirectiveModelOutputError extends Error {
  constructor() {
    super('Invalid directive model output');
    this.name = 'DirectiveModelOutputError';
  }
}

@Injectable()
export class DirectiveInterpreterService {
  private readonly logger =
    new Logger(
      DirectiveInterpreterService.name,
    );

  constructor(
    private readonly groqClientService:
      GroqClientService,
  ) {}

  async interpret(
    request: OptimizeEnergyRequestDto,
  ): Promise<InterpretedDirective[]> {
    const content =
      await this.requestModelContent(
        request,
      );

    if (!content) {
      throw new DirectiveModelOutputError();
    }

    let parsed: GroqDirectiveResponse;

    try {
      parsed = JSON.parse(
        content,
      ) as GroqDirectiveResponse;
    } catch {
      throw new DirectiveModelOutputError();
    }

    if (
      !Array.isArray(
        parsed.directives,
      ) ||
      parsed.directives.length !==
        request.operator_notes.length
    ) {
      throw new DirectiveModelOutputError();
    }

    try {
      return parsed.directives.map(
        (directive) =>
          this.normalizeDirective(
            directive,
          ),
      );
    } catch {
      throw new DirectiveModelOutputError();
    }
  }

  private async requestModelContent(
    request: OptimizeEnergyRequestDto,
  ): Promise<string> {
    let client:
      ReturnType<
        GroqClientService['getClient']
      >;

    let model: string;

    try {
      client =
        this.groqClientService.getClient();

      model =
        this.groqClientService.getModel();
    } catch {
      this.logger.error(
        'LLM provider configuration unavailable',
      );

      throw new InternalServerErrorException(
        'Directive interpretation failed',
      );
    }

    try {
      const response =
        await client.chat.completions.create({
          model,

          temperature: 0,
          reasoning_effort: 'low',
          include_reasoning: false,
          max_completion_tokens: 500,

          messages: [
            {
              role: 'system',

              content: `
Convert each operator note into exactly one GridWise directive.

Return directives in original note order with note_index 0..N-1.

DIRECTIVES

solar_reduction
- usable solar is reduced for specific hours
- adjustment: hours, factor
- factor = usable fraction remaining
- 80% reduction => 0.2
- 25% remains => 0.25
- half remains => 0.5

minimum_battery_reserve
- battery must remain at or above a level
- adjustment: hours, minimum_energy_kwh
- convert percentage reserve using battery.capacity_kwh

no_charge_window
- charging prohibited
- adjustment: hours

no_discharge_window
- discharging prohibited
- adjustment: hours

max_grid_window
- grid import capped
- adjustment: hours, max_grid_kwh

no_op
- unrelated to today's 24-hour energy schedule
- applies=false
- structured_adjustment=null

RULES

- Every note produces exactly one directive.
- Non-no_op directives use applies=true.
- Hours are unique ascending integers 0..23.
- Time windows are start-inclusive and end-exclusive.
- 2 AM to 5 AM => [2,3,4]
- noon to 2 PM => [12,13]
- 1 PM to 3 PM => [13,14]
- 6 PM to 9 PM => [18,19,20]
- 19:00 to 22:00 => [19,20,21]

For structured_adjustment:
- hours always present for non-no_op
- unused numeric fields must be null
- solar_reduction uses factor only
- minimum_battery_reserve uses minimum_energy_kwh only
- max_grid_window uses max_grid_kwh only

Understand paraphrases and equivalent numeric wording.
Do not invent unsupported directives or scenario values.
Keep explanation short.
              `.trim(),
            },

            {
              role: 'user',

              content: JSON.stringify({
                operator_notes:
                  request.operator_notes,

                battery_capacity_kwh:
                  request.battery
                    .capacity_kwh,
              }),
            },
          ],

          response_format: {
            type: 'json_schema',

            json_schema: {
              name:
                'gridwise_directives',

              strict: true,

              schema: {
                type: 'object',
                additionalProperties:
                  false,

                properties: {
                  directives: {
                    type: 'array',

                    items: {
                      type: 'object',
                      additionalProperties:
                        false,

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

                        structured_adjustment:
                          {
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

                              minimum_energy_kwh:
                                {
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

      return (
        response.choices[0]
          ?.message?.content ?? ''
      );
    } catch {
      this.logger.error(
        'LLM provider request failed',
      );

      throw new InternalServerErrorException(
        'Directive interpretation failed',
      );
    }
  }

  private normalizeDirective(
    directive: RawDirective,
  ): InterpretedDirective {
    if (
      !directive ||
      typeof directive !== 'object'
    ) {
      throw new DirectiveModelOutputError();
    }

    if (
      directive.directive_type ===
      'no_op'
    ) {
      if (
        directive
          .structured_adjustment !==
        null
      ) {
        throw new DirectiveModelOutputError();
      }

      return {
        note_index:
          directive.note_index,

        applies:
          directive.applies,

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
      throw new DirectiveModelOutputError();
    }

    switch (
      directive.directive_type
    ) {
      case 'solar_reduction': {
        if (
          adjustment.factor ===
          null
        ) {
          throw new DirectiveModelOutputError();
        }

        return {
          note_index:
            directive.note_index,

          applies:
            directive.applies,

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
          throw new DirectiveModelOutputError();
        }

        return {
          note_index:
            directive.note_index,

          applies:
            directive.applies,

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

          applies:
            directive.applies,

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

          applies:
            directive.applies,

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
          throw new DirectiveModelOutputError();
        }

        return {
          note_index:
            directive.note_index,

          applies:
            directive.applies,

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

      default:
        throw new DirectiveModelOutputError();
    }
  }
}