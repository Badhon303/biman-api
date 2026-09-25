import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type AppRole = 'Super Admin' | 'Manager' | 'Engineer' | 'Biman Admin';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
