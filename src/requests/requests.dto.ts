import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  ticketId: string;

  @IsString()
  @MinLength(1)
  item: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @MinLength(2)
  reason: string;
}

export class RejectRequestDto {
  @IsString()
  @MinLength(2)
  reason: string;
}
