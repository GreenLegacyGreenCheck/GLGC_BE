import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { isRagPolicyItem, RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  // 크롤링은 이 repo 밖에서 이루어진다고 가정하고, 크롤링된 데이터를
  // RAG 서비스의 /update-data로 그대로 전달하는 내부용 엔드포인트.
  @Post('sync')
  @ApiBody({
    schema: {
      example: {
        new_data: [
          {
            cause: '절약시설 부재',
            name: '소상공인 에너지효율화 지원사업',
            url: 'https://example.com/program',
            target: '소상공인',
            action_name: 'LED 조명 교체',
            action_des: '노후 조명을 LED로 교체하는 지원사업입니다.',
            source: '중소벤처기업부',
            takes: '1개월',
            time: '상시',
            need: '사업자등록증',
            level: '중간',
            saving: '연 10만원',
          },
        ],
      },
    },
  })
  syncPolicies(@Body() body: { new_data?: unknown }): Promise<unknown> {
    if (!Array.isArray(body.new_data) || body.new_data.length === 0) {
      throw new BadRequestException('new_data 배열이 필요합니다.');
    }

    if (!body.new_data.every(isRagPolicyItem)) {
      throw new BadRequestException('new_data 항목 형식이 올바르지 않습니다.');
    }

    return this.ragService.updateData(body.new_data);
  }
}
