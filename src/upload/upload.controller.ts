import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UploadService } from './upload.service';

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('presigned-url')
  @ApiOperation({ summary: 'S3 Presigned Upload URL 발급' })
  @ApiQuery({ name: 'filename', example: 'bill.jpg' })
  @ApiQuery({ name: 'contentType', example: 'image/jpeg' })
  async getPresignedUrl(
    @Query('filename') filename: string,
    @Query('contentType') contentType: string,
  ) {
    if (!filename || !contentType) {
      throw new BadRequestException('filename과 contentType이 필요합니다.');
    }

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        '허용되지 않는 파일 형식입니다. (jpeg·png·webp·heic·pdf만 가능)',
      );
    }

    if (!this.uploadService.isAvailable()) {
      throw new NotFoundException('S3가 설정되지 않았습니다.');
    }

    return this.uploadService.createPresignedUploadUrl(filename, contentType);
  }
}
