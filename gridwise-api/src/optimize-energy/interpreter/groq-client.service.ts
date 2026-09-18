import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqClientService {
  private client: Groq | null = null;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  getClient(): Groq {
    if (this.client) {
      return this.client;
    }

    const apiKey =
      this.configService
        .get<string>('GROQ_API_KEY')
        ?.trim();

    if (!apiKey) {
      throw new Error(
        'LLM provider is not configured',
      );
    }

    const timeoutValue =
      this.configService.get<string>(
        'GROQ_TIMEOUT_MS',
      );

    const timeout =
      Number(timeoutValue ?? 10000);

    if (
      !Number.isFinite(timeout) ||
      timeout <= 0
    ) {
      throw new Error(
        'LLM provider configuration is invalid',
      );
    }

this.client = new Groq({
  apiKey,
  timeout,
  maxRetries: 1,
});

    return this.client;
  }

  getModel(): string {
    const model =
      this.configService
        .get<string>('GROQ_MODEL')
        ?.trim();

    if (!model) {
      throw new Error(
        'LLM model is not configured',
      );
    }

    return model;
  }
}