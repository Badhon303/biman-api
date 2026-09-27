import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { PaginationDto } from '../common/pagination.dto';
import {
  AssignTicketDto,
  ChecklistUpdateDto,
  CreateTicketDto,
  FeedbackDto,
  MaintenanceUpdateDto,
  ReturnTicketDto,
  UpdateTicketDto,
  VerifyTicketDto,
} from './tickets.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(
    @Query() query: PaginationDto & { status?: string; assignedToMe?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.list(query, user);
  }

  @Post()
  @Roles('Super Admin', 'Manager', 'Biman Admin')
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.tickets.create(dto, user);
  }

  @Post(':id/assign')
  @Roles('Super Admin', 'Manager')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.assign(id, dto.assignedEngineerId, user);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Manager')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.update(id, dto, user);
  }

  @Post(':id/start')
  @Roles('Engineer')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.startWork(id, user);
  }

  @Patch(':id/maintenance')
  @Roles('Engineer')
  maintenance(
    @Param('id') id: string,
    @Body() dto: MaintenanceUpdateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.updateMaintenance(id, dto, user);
  }

  @Patch(':id/checklist/:itemId')
  @Roles('Engineer')
  checklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ChecklistUpdateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.updateChecklist(id, itemId, dto.checked, user);
  }

  @Post(':id/feedback')
  @Roles('Engineer')
  feedback(
    @Param('id') id: string,
    @Body() dto: FeedbackDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addFeedback(id, dto, user);
  }

  @Post(':id/submit')
  @Roles('Engineer')
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.submitForVerification(id, user);
  }

  @Post(':id/verify-close')
  @Roles('Super Admin', 'Manager')
  verifyClose(
    @Param('id') id: string,
    @Body() dto: VerifyTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.verifyAndClose(id, dto, user);
  }

  @Post(':id/return')
  @Roles('Super Admin', 'Manager')
  returnToEngineer(
    @Param('id') id: string,
    @Body() dto: ReturnTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.returnToEngineer(id, dto.reason, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.get(id, user);
  }
}
