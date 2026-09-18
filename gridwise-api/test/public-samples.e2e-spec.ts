import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';

interface SampleCase {
  id: string;

  input: {
    scenario_id: string;
    operator_notes: string[];
    hours: unknown[];
    battery: {
      initial_energy_kwh: number;
    };
  };

  expected_output: {
    directive_interpretation: Array<{
      note_index: number;
      applies: boolean;
      directive_type: string;
      structured_adjustment: unknown;
    }>;

    total_grid_kwh: number;
    total_cost_bdt: number;
  };
}

interface SampleFile {
  cases: SampleCase[];
}

describe.sequential('Public sample cases (e2e)', () => {
  let app: INestApplication<App>;
  let samples: SampleCase[];

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    await app.init();

    const filePath = resolve(
      process.cwd(),
      'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json',
    );

    const file = JSON.parse(
      readFileSync(filePath, 'utf-8'),
    ) as SampleFile;

    samples = file.cases;
  });

  afterAll(async () => {
    await app.close();
  });

  for (let i = 1; i <= 10; i++) {
    const sampleId =
      `SAMPLE-${String(i).padStart(2, '0')}`;

    it(
      `${sampleId} should interpret directives and reach optimal cost`,
      async () => {
        const sample = samples.find(
          (item) => item.id === sampleId,
        );

        expect(sample).toBeDefined();

        if (!sample) {
          throw new Error(
            `Missing ${sampleId}`,
          );
        }

        const response = await request(
          app.getHttpServer(),
        )
          .post('/optimize-energy')
          .send(sample.input)
          .expect(201);

        expect(
          response.body.scenario_id,
        ).toBe(sample.input.scenario_id);

        expect(
          response.body.directive_interpretation,
        ).toHaveLength(
          sample.expected_output
            .directive_interpretation.length,
        );

        for (
          let index = 0;
          index <
          sample.expected_output
            .directive_interpretation.length;
          index++
        ) {
          const actual =
            response.body
              .directive_interpretation[index];

          const expected =
            sample.expected_output
              .directive_interpretation[index];

          expect(actual.note_index).toBe(
            expected.note_index,
          );

          expect(actual.applies).toBe(
            expected.applies,
          );

          expect(
            actual.directive_type,
          ).toBe(
            expected.directive_type,
          );

          expect(
            actual.structured_adjustment,
          ).toEqual(
            expected.structured_adjustment,
          );
        }

        expect(
          response.body.hourly_plan,
        ).toHaveLength(24);

        expect(
          response.body.total_grid_kwh,
        ).toBeCloseTo(
          sample.expected_output
            .total_grid_kwh,
          2,
        );

        expect(
          response.body.total_cost_bdt,
        ).toBeCloseTo(
          sample.expected_output
            .total_cost_bdt,
          2,
        );

        const finalHour =
          response.body.hourly_plan[23];

        expect(
          finalHour
            .battery_energy_after_kwh,
        ).toBeCloseTo(
          sample.input.battery
            .initial_energy_kwh,
          2,
        );
      },
      30000,
    );
  }
});