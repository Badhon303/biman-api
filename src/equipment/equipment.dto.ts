import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SpecificationDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsString()
  value: string;
}

export class CreateEquipmentDto {
  @IsString()
  equipmentTypeId: string;

  @IsString()
  manufacturer: string;

  @IsString()
  model: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  engineModel?: string;

  @IsOptional()
  @IsString()
  engineSerialNo?: string;

  @IsOptional()
  @IsString()
  bimanSerialNo?: string;

  @IsOptional()
  @IsString()
  tldSerialNo?: string;

  @IsOptional()
  @IsString()
  tireSize?: string;

  @IsOptional()
  @IsIn(['Available', 'Under Maintenance', 'Out of Service', 'Inactive'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourMeter?: number;

  @IsOptional()
  @IsDateString()
  actualGtDate?: string;

  @IsOptional()
  @IsDateString()
  lastVServiceDate?: string;

  @IsOptional()
  @IsDateString()
  shipDate?: string;

  @IsOptional()
  @IsString()
  shippingStatus?: string;

  @IsOptional()
  @IsString()
  emissionRating?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications?: SpecificationDto[];
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  equipmentTypeId?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  engineModel?: string;

  @IsOptional()
  @IsString()
  engineSerialNo?: string;

  @IsOptional()
  @IsString()
  bimanSerialNo?: string;

  @IsOptional()
  @IsString()
  tldSerialNo?: string;

  @IsOptional()
  @IsString()
  tireSize?: string;

  @IsOptional()
  @IsIn(['Available', 'Under Maintenance', 'Out of Service', 'Inactive'])
  status?: string;

  @IsOptional()
  @IsDateString()
  actualGtDate?: string;

  @IsOptional()
  @IsDateString()
  lastVServiceDate?: string;

  @IsOptional()
  @IsDateString()
  shipDate?: string;

  @IsOptional()
  @IsString()
  shippingStatus?: string;

  @IsOptional()
  @IsString()
  emissionRating?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecificationDto)
  specifications?: SpecificationDto[];
}

export class UpdateHourMeterDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;
}

export class ServiceCheckDto {
  @IsString()
  @MinLength(1)
  dueDateByServiceId: Record<string, string>;
}
