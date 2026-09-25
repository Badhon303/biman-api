import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AppRole } from '../common/roles.decorator';

const roles: AppRole[] = ['Super Admin', 'Manager', 'Engineer', 'Biman Admin'];

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsIn(roles)
  role: AppRole;

  @IsOptional()
  @IsIn(['NGGL', 'Biman'])
  organization?: 'NGGL' | 'Biman';

  @IsOptional()
  @IsString()
  @MinLength(12)
  temporaryPassword?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(roles)
  role?: AppRole;

  @IsOptional()
  @IsIn(['NGGL', 'Biman'])
  organization?: 'NGGL' | 'Biman';

  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';
}
