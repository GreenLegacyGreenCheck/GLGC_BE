import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBody } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { DiagnosisService, isCreateDiagnosisInput } from './diagnosis.service';

@Controller('diagnosis')
export class DiagnosisController {
  constructor(
    private readonly diagnosisService: DiagnosisService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @ApiBody({
    schema: {
      example: {
        target: '소상공인',
        electricityRatio: 0.7,
        gasRatio: 0.2,
        targetEmissionKg: 2840,
        address: '서울 마포구',
        usageKwh: 287,
        gasUsageMj: 1840.0,
        billingMonth: '2026-06',
      },
    },
  })
  async create(
    @Body() body: unknown,
    @Headers('authorization') authHeader?: string,
  ) {
    if (!isCreateDiagnosisInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    // 로그인 없이도 진단은 그대로 동작해야 해서, 토큰이 없거나 무효해도 막지
    // 않고 익명 진단(userId: null)으로 저장한다.
    const userId = await this.authService.getUserIdFromAuthHeader(authHeader);

    return this.diagnosisService.create(body, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagnosisService.findById(id);
  }

  @Get(':id/actions/:actionCode/policy')
  getPolicy(@Param('id') id: string, @Param('actionCode') actionCode: string) {
    return this.diagnosisService.getPolicyForAction(id, actionCode);
  }

  @Post(':id/actions/:actionCode/policy')
  getPolicyWithReason(
    @Param('id') id: string,
    @Param('actionCode') actionCode: string,
  ) {
    return this.diagnosisService.getPolicyForAction(id, actionCode);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string } | undefined,
  ) {
    if (!user) throw new UnauthorizedException();
    await this.diagnosisService.delete(id, user.id);
  }
}
