import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class HourInputDto {
  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  demand_kwh: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  solar_kwh: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  tariff_bdt_per_kwh: number;
}

export class BatteryInputDto {
  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  capacity_kwh: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  initial_energy_kwh: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  minimum_energy_kwh: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  max_charge_kwh_per_hour: number;

  @IsNumber({
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  max_discharge_kwh_per_hour: number;
}

export class OptimizeEnergyRequestDto {
  @IsString()
  @IsNotEmpty()
  scenario_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  operator_notes: string[];

  @IsArray()
  @ArrayMinSize(24)
  @ArrayMaxSize(24)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => HourInputDto)
  hours: HourInputDto[];

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => BatteryInputDto)
  battery: BatteryInputDto;
}