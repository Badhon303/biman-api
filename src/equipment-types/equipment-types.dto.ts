import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EquipmentTypeServiceDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;
}

export class CreateEquipmentTypeDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EquipmentTypeServiceDto)
  services: EquipmentTypeServiceDto[];
}

export class UpdateEquipmentTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EquipmentTypeServiceDto)
  services?: EquipmentTypeServiceDto[];
}
