import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { CreateRequestDto, RejectRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  list(
    @Query() query: PaginationDto & { status?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.list(query, user);
  }

  @Post()
  @Roles('Engineer', 'Manager', 'Super Admin')
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.create(dto, user);
  }

  @Post(':id/approve')
  @Roles('Biman Admin', 'Manager', 'Super Admin')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requests.approve(id, 'APPROVED', user);
  }

  @Post(':id/reject')
  @Roles('Biman Admin', 'Manager', 'Super Admin')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.requests.approve(id, 'REJECTED', user, dto.reason);
  }

  @Post(':id/receive')
  @Roles('Biman Admin', 'Manager', 'Super Admin')
  receive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requests.receive(id, user);
  }
}
