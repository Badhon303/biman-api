import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/roles.decorator';
import {
  CategoryDto,
  CreateItemDto,
  UpdateItemDto,
} from './inspection-checklists.dto';
import { InspectionChecklistsService } from './inspection-checklists.service';

@ApiTags('inspection-checklists')
@ApiBearerAuth()
@Roles('Super Admin', 'Manager')
@Controller('inspection-checklists')
export class InspectionChecklistsController {
  constructor(private readonly checklists: InspectionChecklistsService) {}

  @Get()
  list() {
    return this.checklists.list();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.checklists.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) {
    return this.checklists.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.checklists.removeCategory(id);
  }

  @Post('items')
  createItem(@Body() dto: CreateItemDto) {
    return this.checklists.createItem(dto);
  }

  @Put('items/:id')
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.checklists.updateItem(id, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string) {
    return this.checklists.removeItem(id);
  }
}
