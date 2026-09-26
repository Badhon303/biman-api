import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { AllowPasswordChange } from '../common/public.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDto } from '../auth/auth.dto';
import {
  CreateUserDto,
  SetUserPasswordDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('me')
  @AllowPasswordChange()
  me(@CurrentUser() user: AuthUser) {
    return this.users.get(user.sub);
  }

  @Patch('me/password')
  @AllowPasswordChange()
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user, dto);
  }

  @Get()
  @Roles('Super Admin', 'Manager')
  list(@Query() query: PaginationDto) {
    return this.users.list(query);
  }

  @Get('engineers')
  @Roles('Super Admin', 'Manager')
  listEngineers(@Query() query: PaginationDto) {
    return this.users.listEngineers(query);
  }

  @Post()
  @Roles('Super Admin')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get(':id')
  @Roles('Super Admin')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Patch(':id/status')
  @Roles('Super Admin', 'Manager')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateStatus(id, dto.status, user);
  }

  @Patch(':id')
  @Roles('Super Admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  remove(@Param('id') id: string) {
    return this.users.remove(id);
  }

  @Patch(':id/password')
  @Roles('Super Admin')
  setPassword(@Param('id') id: string, @Body() dto: SetUserPasswordDto) {
    return this.users.setPassword(id, dto.newPassword);
  }

  @Post(':id/reset-password')
  @Roles('Super Admin')
  resetPassword(@Param('id') id: string) {
    return this.users.resetPassword(id);
  }
}
