import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqClientService {
  private readonly client: Groq;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const apiKey =
      this.configService.get<string>(
        'GROQ_API_KEY',
      );

    const model =
      this.configService.get<string>(
        'GROQ_MODEL',
      );

    const timeoutValue =
      this.configService.get<string>(
        'GROQ_TIMEOUT_MS',
      );

    if (!apiKey) {
      throw new Error(
        'GROQ_API_KEY is not configured',
      );
    }

    if (!model) {
      throw new Error(
        'GROQ_MODEL is not configured',
      );
    }

    const timeout =
      Number(timeoutValue ?? 10000);

    if (
      !Number.isFinite(timeout) ||
      timeout <= 0
    ) {
      throw new Error(
        'GROQ_TIMEOUT_MS must be a positive number',
      );
    }

    this.client = new Groq({
      apiKey,

      // Maximum time for one Groq request.
      timeout,

      // Retry once for transient API/network failures.
      maxRetries: 1,
    });

    this.model = model;
  }

  getClient(): Groq {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }
}