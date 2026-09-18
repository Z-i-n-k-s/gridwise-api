import { Test, TestingModule } from '@nestjs/testing';
import { OptimizeEnergyService } from './optimize-energy.service.js';

describe('OptimizeEnergyService', () => {
  let service: OptimizeEnergyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OptimizeEnergyService],
    }).compile();

    service = module.get<OptimizeEnergyService>(OptimizeEnergyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
