import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RagPolicyItem = {
  cause: string;
  name: string;
  url: string;
  target: string;
  action_name: string;
  action_des: string;
  source: string;
  takes: string;
  time: string;
  need: string;
  level: string;
  saving: string;
};

export function isRagPolicyItem(value: unknown): value is RagPolicyItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.cause === 'string' &&
    typeof item.name === 'string' &&
    typeof item.url === 'string' &&
    typeof item.target === 'string' &&
    typeof item.action_name === 'string' &&
    typeof item.action_des === 'string' &&
    typeof item.source === 'string' &&
    typeof item.takes === 'string' &&
    typeof item.time === 'string' &&
    typeof item.need === 'string' &&
    typeof item.level === 'string' &&
    typeof item.saving === 'string'
  );
}

@Injectable()
export class RagService {
  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const baseUrl = this.configService.get<string>('RAG_API_URL');

    if (!baseUrl) {
      throw new HttpException(
        'RAG_API_URL이 설정되지 않았습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return baseUrl;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const baseUrl = this.getBaseUrl();

    let response: Response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new HttpException(
        'RAG 서비스에 연결할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        'RAG 서비스 요청이 실패했습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return response.json();
  }

  // RAG의 /recommend 응답 스키마는 아직 문서화되어 있지 않아 그대로 통과시킨다.
  // 형태가 확정되면 타입 가드를 추가해 검증한다.
  recommend(input: { cause: string; target: string }): Promise<unknown> {
    return this.post('/recommend', input);
  }

  updateData(newData: RagPolicyItem[]): Promise<unknown> {
    return this.post('/update-data', { new_data: newData });
  }
}
