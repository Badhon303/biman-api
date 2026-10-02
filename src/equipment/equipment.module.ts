import { Module } from '@nestjs/common';
import { SchedulesModule } from '../maintenance-schedules/schedules.module';
import { StorageModule } from '../storage/storage.module';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [SchedulesModule, StorageModule],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
