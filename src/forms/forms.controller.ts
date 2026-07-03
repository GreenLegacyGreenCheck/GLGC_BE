import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'PDF 서식을 Gemini Vision으로 분석해 필드 좌표 반환' })
  @ApiBody({ schema: { example: { pdfUrl: 'https://www.glgc.cloud/forms/solar-application.pdf' } } })
  async analyze(@Body() body: unknown) {
    if (
      !body ||
      typeof body !== 'object' ||
      !('pdfUrl' in body) ||
      typeof (body as Record<string, unknown>).pdfUrl !== 'string'
    ) {
      throw new BadRequestException('pdfUrl(string)이 필요합니다.');
    }
    return this.formsService.analyzeFormFields(
      (body as { pdfUrl: string }).pdfUrl,
    );
  }
}
