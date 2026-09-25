import { Body, Controller, Get, Post } from '@nestjs/common';
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

  @Post()
  @Roles('Super Admin', 'Manager')
  create(@Body() dto: CreateScheduleDto) {
    return this.schedules.create(dto);
  }
}
