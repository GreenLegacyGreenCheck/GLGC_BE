import { Module } from '@nestjs/common';
import { XgboostController } from './xgboost.controller';
import { XgboostService } from './xgboost.service';

@Module({
  controllers: [XgboostController],
  providers: [XgboostService],
  exports: [XgboostService],
})
export class XgboostModule {}
