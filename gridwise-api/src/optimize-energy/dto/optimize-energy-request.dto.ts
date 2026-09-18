import {
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HourInputDto {
  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsNumber()
  @Min(0)
  demand_kwh: number;

  @IsNumber()
  @Min(0)
  solar_kwh: number;

  @IsNumber()
  @Min(0)
  tariff_bdt_per_kwh: number;
}

export class BatteryInputDto {
  @IsNumber()
  @Min(0)
  capacity_kwh: number;

  @IsNumber()
  @Min(0)
  initial_energy_kwh: number;

  @IsNumber()
  @Min(0)
  minimum_energy_kwh: number;

  @IsNumber()
  @Min(0)
  max_charge_kwh_per_hour: number;

  @IsNumber()
  @Min(0)
  max_discharge_kwh_per_hour: number;
}

export class OptimizeEnergyRequestDto {
  @IsString()
  scenario_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  operator_notes: string[];

  @IsArray()
  @ArrayMinSize(24)
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => HourInputDto)
  hours: HourInputDto[];

  @ValidateNested()
  @Type(() => BatteryInputDto)
  battery: BatteryInputDto;
}