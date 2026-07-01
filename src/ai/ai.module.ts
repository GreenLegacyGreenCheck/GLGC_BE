import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ActionsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
