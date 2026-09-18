import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import {
  OptimizeEnergyController,
} from './optimize-energy.controller.js';

import {
  OptimizeEnergyService,
} from './optimize-energy.service.js';

describe(
  'OptimizeEnergyController',
  () => {
    let controller:
      OptimizeEnergyController;

    beforeEach(async () => {
      const module:
        TestingModule =
        await Test.createTestingModule({
          controllers: [
            OptimizeEnergyController,
          ],

          providers: [
            {
              provide:
                OptimizeEnergyService,

              useValue: {
                optimize:
                  vi.fn(),
              },
            },
          ],
        }).compile();

      controller =
        module.get<OptimizeEnergyController>(
          OptimizeEnergyController,
        );
    });

    it(
      'should be defined',
      () => {
        expect(
          controller,
        ).toBeDefined();
      },
    );
  },
);