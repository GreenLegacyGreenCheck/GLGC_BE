import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const RAG_CAUSES = [
  '절약시설 부재',
  '단열 불량',
  '운영 습관',
  '냉방설비 노후화',
] as const;

export type RagCause = (typeof RAG_CAUSES)[number];

export type RagPolicyItem = {
  cause: RagCause;
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
    RAG_CAUSES.includes(item.cause as RagCause) &&
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

  // userType → RAG target 매핑
  private mapTarget(target: string): string {
    if (target === '취약계층') return '기후취약계층';
    return target; // 소상공인, 일반가구 그대로
  }

  recommend(input: { cause: string; target: string }): Promise<unknown> {
    return this.post('/recommend', {
      cause: input.cause,
      target: this.mapTarget(input.target),
    });
  }

  updateData(newData: RagPolicyItem[]): Promise<unknown> {
    return this.post('/update-data', { new_data: newData });
  }
}
