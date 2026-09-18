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

import {
  GroqClientService,
} from '../src/optimize-energy/interpreter/groq-client.service.js';

interface SampleFile {
  cases: Array<{
    input: Record<
      string,
      unknown
    >;
  }>;
}

describe(
  'LLM provider failure (e2e)',
  () => {
    let app: INestApplication<App>;
    let validInput:
      Record<string, unknown>;

    beforeAll(async () => {
      const failingClient = {
        chat: {
          completions: {
            create: async () => {
              throw new Error(
                'SECRET_PROVIDER_ERROR',
              );
            },
          },
        },
      };

      const moduleFixture:
        TestingModule =
        await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider(
            GroqClientService,
          )
          .useValue({
            getClient: () =>
              failingClient,

            getModel: () =>
              'test-model',
          })
          .compile();

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

    it(
      'GET /health remains available',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get('/health')
          .expect(200)
          .expect({
            status: 'ok',
          });
      },
    );

    it(
      'returns controlled 500 when LLM provider fails',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .post(
              '/optimize-energy',
            )
            .send(validInput)
            .expect(500);

        expect(
          response.body.message,
        ).toBe(
          'Directive interpretation failed',
        );

        expect(
          JSON.stringify(
            response.body,
          ),
        ).not.toContain(
          'SECRET_PROVIDER_ERROR',
        );
      },
    );
  },
);