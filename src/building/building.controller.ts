import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';
import { BuildingService } from './building.service';

@Controller('building')
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  @Post('infer-user-type')
  @ApiOperation({ summary: '주소 → 건축물대장 조회 → 사용자 유형 추론' })
  @ApiBody({ schema: { example: { address: '서울특별시 노원구 덕릉로 639' } } })
  async inferUserType(@Body() body: unknown) {
    if (
      !body ||
      typeof body !== 'object' ||
      !('address' in body) ||
      typeof (body as Record<string, unknown>).address !== 'string'
    ) {
      throw new BadRequestException('address(string)가 필요합니다.');
    }
    const result = await this.buildingService.inferUserType(
      (body as { address: string }).address,
    );
    return { userType: result }; // null이면 프론트가 Z-score fallback 사용
  }
}
