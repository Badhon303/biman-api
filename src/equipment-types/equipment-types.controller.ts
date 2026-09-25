import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/roles.decorator';
import {
  CreateEquipmentTypeDto,
  UpdateEquipmentTypeDto,
} from './equipment-types.dto';
import { EquipmentTypesService } from './equipment-types.service';

@ApiTags('equipment-types')
@ApiBearerAuth()
@Controller('equipment-types')
export class EquipmentTypesController {
  constructor(private readonly equipmentTypes: EquipmentTypesService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.equipmentTypes.list(search);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.equipmentTypes.get(id);
  }

  @Post()
  @Roles('Super Admin', 'Manager')
  create(@Body() dto: CreateEquipmentTypeDto) {
    return this.equipmentTypes.create(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Manager')
  update(@Param('id') id: string, @Body() dto: UpdateEquipmentTypeDto) {
    return this.equipmentTypes.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin', 'Manager')
  remove(@Param('id') id: string) {
    return this.equipmentTypes.remove(id);
  }
}
