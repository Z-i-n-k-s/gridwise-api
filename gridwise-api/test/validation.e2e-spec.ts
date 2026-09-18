import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import {
  Test,
  TestingModule,
} from '@nestjs/testing';

import request from 'supertest';
import { App } from 'supertest/types';

import {
  AppModule,
} from '../src/app.module.js';

interface SampleFile {
  cases: Array<{
    input: Record<string, unknown>;
  }>;
}

describe(
  'Request validation (e2e)',
  () => {
    let app: INestApplication<App>;
    let validInput:
      Record<string, any>;

    beforeAll(async () => {
      const moduleFixture:
        TestingModule =
        await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

      app =
        moduleFixture.createNestApplication();

      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          transform: true,
        }),
      );

      await app.init();

      const filePath =
        resolve(
          process.cwd(),
          'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json',
        );

      const file =
        JSON.parse(
          readFileSync(
            filePath,
            'utf-8',
          ),
        ) as SampleFile;

      validInput =
        file.cases[0].input;
    });

    afterAll(async () => {
      await app.close();
    });

    const cloneInput = () =>
      structuredClone(validInput);

    it(
      'rejects missing battery',
      async () => {
        const input =
          cloneInput();

        delete input.battery;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects empty scenario_id',
      async () => {
        const input =
          cloneInput();

        input.scenario_id =
          '   ';

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects zero operator notes',
      async () => {
        const input =
          cloneInput();

        input.operator_notes = [];

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects more than three operator notes',
      async () => {
        const input =
          cloneInput();

        input.operator_notes = [
          'note 1',
          'note 2',
          'note 3',
          'note 4',
        ];

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects blank operator note',
      async () => {
        const input =
          cloneInput();

        input.operator_notes = [
          '   ',
        ];

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects fewer than 24 hours',
      async () => {
        const input =
          cloneInput();

        input.hours =
          input.hours.slice(
            0,
            23,
          );

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects duplicate hour',
      async () => {
        const input =
          cloneInput();

        input.hours[23].hour = 22;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects negative demand',
      async () => {
        const input =
          cloneInput();

        input.hours[0]
          .demand_kwh = -1;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects initial battery energy above capacity',
      async () => {
        const input =
          cloneInput();

        input.battery
          .initial_energy_kwh =
          input.battery
            .capacity_kwh + 1;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects minimum battery energy above capacity',
      async () => {
        const input =
          cloneInput();

        input.battery
          .minimum_energy_kwh =
          input.battery
            .capacity_kwh + 1;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects initial energy below minimum energy',
      async () => {
        const input =
          cloneInput();

        input.battery
          .minimum_energy_kwh =
          input.battery
            .initial_energy_kwh + 1;

        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .send(input)
          .expect(400);
      },
    );

    it(
      'rejects malformed JSON',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .post(
            '/optimize-energy',
          )
          .set(
            'Content-Type',
            'application/json',
          )
          .send(
            '{"scenario_id":',
          )
          .expect(400);
      },
    );
  },
);