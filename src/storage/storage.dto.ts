import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UploadImageDto {
  @IsIn(['EQUIPMENT_PHOTO', 'WORK_IMAGE', 'FEEDBACK_IMAGE'])
  purpose: 'EQUIPMENT_PHOTO' | 'WORK_IMAGE' | 'FEEDBACK_IMAGE';

  @IsString()
  ownerId: string;
}

export class UploadDocumentDto {
  @IsString()
  equipmentId: string;

  @IsString()
  name: string;

  @IsIn(['Manual', 'Insurance', 'Certificate', 'Other'])
  type: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class AttachFileDto {
  @IsOptional()
  @IsString()
  equipmentId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;

  @IsOptional()
  @IsString()
  feedbackId?: string;

  @IsOptional()
  @IsIn(['PRIMARY', 'FRONT', 'SIDE', 'OTHER'])
  slot?: 'PRIMARY' | 'FRONT' | 'SIDE' | 'OTHER';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['Manual', 'Insurance', 'Certificate', 'Other'])
  type?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
