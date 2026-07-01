import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module';
import { AuthModule } from '../auth/auth.module';
import { PushModule } from '../push/push.module';
import { RagModule } from '../rag/rag.module';
import { DiagnosisController } from './diagnosis.controller';
import { DiagnosisService } from './diagnosis.service';

@Module({
  imports: [ActionsModule, RagModule, AuthModule, PushModule],
  controllers: [DiagnosisController],
  providers: [DiagnosisService],
})
export class DiagnosisModule {}
