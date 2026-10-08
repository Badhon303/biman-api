import { Module } from '@nestjs/common';
import { InspectionChecklistsController } from './inspection-checklists.controller';
import { InspectionChecklistsService } from './inspection-checklists.service';

@Module({
  controllers: [InspectionChecklistsController],
  providers: [InspectionChecklistsService],
})
export class InspectionChecklistsModule {}
