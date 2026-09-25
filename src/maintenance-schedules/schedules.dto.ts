import { IsDateString, IsString } from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  equipmentId: string;

  @IsDateString()
  lastDate: string;
}
