import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/roles.decorator';
import { CreateScheduleDto } from './schedules.dto';
import { SchedulesService } from './schedules.service';

@ApiTags('maintenance-schedules')
@ApiBearerAuth()
@Controller('maintenance-schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  list() {
    return this.schedules.list();
  }

  @Get('archive')
  @Roles('Super Admin', 'Manager')
  archive() {
    return this.schedules.archive();
  }

  @Post(':id/restore')
  @Roles('Super Admin', 'Manager')
  restore(@Param('id') id: string) {
    return this.schedules.restore(id);
  }

  @Delete(':id/permanent')
  @Roles('Super Admin', 'Manager')
  permanentlyRemove(@Param('id') id: string) {
    return this.schedules.permanentlyRemove(id);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.schedules.remove(id);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  create(@Body() dto: CreateScheduleDto) {
    return this.schedules.create(dto);
  }
}
