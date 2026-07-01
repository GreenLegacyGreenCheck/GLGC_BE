import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { isXgboostDiagnoseInput, XgboostService } from './xgboost.service';

@Controller()
export class XgboostController {
  constructor(private readonly xgboostService: XgboostService) {}

  @Post('xgboost-diagnose')
  @ApiBody({
    schema: {
      example: {
        elec_kwh: 356.2,
        gas_mj: 1840.0,
        device_usage: {
          cooling: 150.0,
          lighting: 80.0,
          etc: 126.2,
        },
        national_avg_tco2: null,
        industry_avg_tco2: null,
        industry_avg_kwh: null,
        esg_answers: {
          'E-1-2': 4,
          'E-6-1': 3,
          'S-근로조건': 5,
          'S-지역사회': 4,
          'G-4-1': 5,
          'G-정보관리': 4,
        },
      },
    },
  })
  diagnose(@Body() body: unknown): Promise<unknown> {
    if (!isXgboostDiagnoseInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    return this.xgboostService.diagnose(body);
  }

  @Get('esg-questions')
  getEsgQuestions(): Promise<unknown> {
    return this.xgboostService.getEsgQuestions();
  }
}
