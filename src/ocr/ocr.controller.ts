import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from '../upload/upload.service';
import { OcrResult, OcrService } from './ocr.service';

@Controller('ocr')
export class OcrController {
  constructor(
    private readonly ocrService: OcrService,
    private readonly uploadService: UploadService,
  ) {}

  // ① 기존 방식: multipart/form-data로 파일 직접 전송
  @Post('bill')
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  async recognizeBill(
    @UploadedFile() file: Express.Multer.File,
    @Body('s3Key') s3Key?: string,
  ): Promise<OcrResult> {
    // ② Presigned URL 방식: S3 key만 전달하면 파일을 S3에서 내려받아 OCR
    if (s3Key) {
      const { buffer, contentType } =
        await this.uploadService.downloadFileBuffer(s3Key);

      const mockFile: Express.Multer.File = {
        buffer,
        mimetype: contentType,
        originalname: s3Key.split('/').pop() ?? 'bill',
        fieldname: 'image',
        encoding: '7bit',
        size: buffer.length,
        stream: null as never,
        destination: '',
        filename: '',
        path: '',
      };

      return this.ocrService.recognizeBill(mockFile);
    }

    if (!file) {
      throw new BadRequestException(
        'image 파일 또는 s3Key 중 하나가 필요합니다.',
      );
    }

    return this.ocrService.recognizeBill(file);
  }

  // ③ Presigned URL 전용 엔드포인트 (JSON body)
  @Post('bill/s3')
  @ApiBody({ schema: { example: { s3Key: 'bills/uuid.jpg' } } })
  async recognizeBillFromS3(
    @Body('s3Key') s3Key: string,
  ): Promise<OcrResult> {
    if (!s3Key) {
      throw new BadRequestException('s3Key가 필요합니다.');
    }

    const { buffer, contentType } =
      await this.uploadService.downloadFileBuffer(s3Key);

    const mockFile: Express.Multer.File = {
      buffer,
      mimetype: contentType,
      originalname: s3Key.split('/').pop() ?? 'bill',
      fieldname: 'image',
      encoding: '7bit',
      size: buffer.length,
      stream: null as never,
      destination: '',
      filename: '',
      path: '',
    };

    return this.ocrService.recognizeBill(mockFile);
  }
}
