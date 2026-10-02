import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import { PaginationDto } from '../common/pagination.dto';
import {
  CreateEquipmentDto,
  ServiceCheckDto,
  UpdateEquipmentDto,
  UpdateHourMeterDto,
} from './equipment.dto';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@ApiBearerAuth()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  list(
    @Query()
    query: PaginationDto & { status?: string; equipmentTypeId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.list(query, user);
  }

  @Get('archive')
  @Roles('Super Admin', 'Manager')
  archive() {
    return this.equipment.archive();
  }

  @Post(':id/restore')
  @Roles('Super Admin', 'Manager')
  restore(@Param('id') id: string) {
    return this.equipment.restore(id);
  }

  @Delete(':id/permanent')
  @Roles('Super Admin', 'Manager')
  permanentlyRemove(@Param('id') id: string) {
    return this.equipment.permanentlyRemove(id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.equipment.get(id, user);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: AuthUser) {
    return this.equipment.create(dto, user);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipment.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.equipment.remove(id);
  }

  @Post(':id/hour-meter')
  @Roles('Engineer', 'Manager', 'Super Admin')
  updateHourMeter(
    @Param('id') id: string,
    @Body() dto: UpdateHourMeterDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.updateHourMeter(id, dto.value, user);
  }

  @Post(':id/hour-meter/service-check')
  @Roles('Engineer', 'Manager', 'Super Admin')
  serviceCheck(
    @Param('id') id: string,
    @Body() dto: ServiceCheckDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.equipment.serviceCheck(id, dto, user);
  }
}
