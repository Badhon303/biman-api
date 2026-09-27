import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsIn(['Breakdown', 'General', 'Washing'])
  serviceType: 'Breakdown' | 'General' | 'Washing';

  @IsString()
  equipmentId: string;

  @IsString()
  @MinLength(2)
  faultDescription: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsIn(['Low', 'Medium', 'High', 'Critical'])
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';

  @IsOptional()
  @IsString()
  requestingParty?: string;
}

export class AssignTicketDto {
  @IsString()
  assignedEngineerId: string;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['Low', 'Medium', 'High', 'Critical'])
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  requestingParty?: string;
}

export class ChecklistUpdateDto {
  @IsBoolean()
  checked: boolean;
}

export class MaintenanceUpdateDto {
  @IsOptional()
  @IsString()
  problemDescription?: string;

  @IsOptional()
  @IsString()
  partsUsed?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  labourHours?: number;

  @IsOptional()
  @IsBoolean()
  functionalTestPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  safetyCheckPassed?: boolean;
}

export class FeedbackDto {
  @IsString()
  @MinLength(1)
  bodyHtml: string;
}

export class ReturnTicketDto {
  @IsString()
  @MinLength(2)
  reason: string;
}

export class VerifyTicketDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  downtimeHours?: number;
}
