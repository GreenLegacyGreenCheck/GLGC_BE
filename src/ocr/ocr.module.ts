import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [UploadModule],
  controllers: [OcrController],
  providers: [OcrService],
})
export class OcrModule {}
