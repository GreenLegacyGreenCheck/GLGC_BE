import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { AiService, isAiInsightInput } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('insight')
  @ApiBody({
    schema: {
      example: {
        annualEmissionTons: 1.64,
        grade: 'B',
        elecRatioPercent: 96.1,
        gasRatioPercent: 3.9,
        diffVsNationalPercent: -99.2,
        diffVsIndustryPercent: -99.2,
        rankedFactors: [
          { factor: '전기 사용량', valuePercent: -99.1, rank: 1 },
          { factor: '가스 사용량', valuePercent: 66.1, rank: 2 },
        ],
        actions: [
          { code: 'LED_LIGHTING', title: 'LED 조명 교체' },
          { code: 'HVAC_EFFICIENCY', title: '냉난방 효율 개선' },
        ],
      },
    },
  })
  generateInsight(@Body() body: unknown) {
    if (!isAiInsightInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }
    return this.aiService.generateInsight(body);
  }
}
