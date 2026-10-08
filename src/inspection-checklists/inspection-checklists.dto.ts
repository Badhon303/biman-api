import { IsString, IsUUID, MinLength } from 'class-validator';

export class CategoryDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class CreateItemDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(1)
  label: string;
}

export class UpdateItemDto {
  @IsString()
  @MinLength(1)
  label: string;
}
