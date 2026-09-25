import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  sub: string;
  email: string;
  role: 'Super Admin' | 'Manager' | 'Engineer' | 'Biman Admin';
  organization: 'NGGL' | 'Biman';
  mustChangePassword: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest().user,
);
