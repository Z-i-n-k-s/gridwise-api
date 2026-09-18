import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqClientService {
  private readonly client: Groq;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    const model = this.configService.get<string>('GROQ_MODEL');

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    if (!model) {
      throw new Error('GROQ_MODEL is not configured');
    }

    this.client = new Groq({
      apiKey,
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