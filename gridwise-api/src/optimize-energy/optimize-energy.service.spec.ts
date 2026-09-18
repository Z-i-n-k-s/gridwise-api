import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  OptimizeEnergyService,
} from './optimize-energy.service.js';

import {
  DirectiveInterpreterService,
} from './interpreter/directive-interpreter.service.js';

import {
  DirectiveGuardrailService,
} from './guardrails/directive-guardrail.service.js';

import {
  RequestValidatorService,
} from './validation/request-validator.service.js';

import {
  ConstraintBuilderService,
} from './optimizer/constraint-builder.service.js';

import {
  EnergyOptimizerService,
} from './optimizer/energy-optimizer.service.js';

import {
  PlanValidatorService,
} from './validation/plan-validator.service.js';

import {
  PlanSummaryService,
} from './summary/plan-summary.service.js';

describe(
  'OptimizeEnergyService',
  () => {
    let service:
      OptimizeEnergyService;

    beforeEach(async () => {
      const module:
        TestingModule =
        await Test.createTestingModule({
          providers: [
            OptimizeEnergyService,

            {
              provide:
                DirectiveInterpreterService,

              useValue: {
                interpret:
                  vi.fn(),
              },
            },

            {
              provide:
                DirectiveGuardrailService,

              useValue: {
                validate:
                  vi.fn(),
              },
            },

            {
              provide:
                RequestValidatorService,

              useValue: {
                validate:
                  vi.fn(),
              },
            },

            {
              provide:
                ConstraintBuilderService,

              useValue: {
                build:
                  vi.fn(),
              },
            },

            {
              provide:
                EnergyOptimizerService,

              useValue: {
                optimize:
                  vi.fn(),
              },
            },

            {
              provide:
                PlanValidatorService,

              useValue: {
                validate:
                  vi.fn(),
              },
            },

            {
              provide:
                PlanSummaryService,

              useValue: {
                generate:
                  vi.fn(),
              },
            },
          ],
        }).compile();

      service =
        module.get<OptimizeEnergyService>(
          OptimizeEnergyService,
        );
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  },
);