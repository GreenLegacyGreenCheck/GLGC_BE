import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type OcrWord = { text: string; confidence: number };
export type OcrResult = { text: string; confidence: number; words: OcrWord[] };

type ClovaVertex = { x: number; y: number };
type ClovaField = {
  inferText: string;
  inferConfidence: number;
  lineBreak: boolean;
  boundingPoly: { vertices: ClovaVertex[] };
};
type ClovaResponse = {
  images: Array<{ inferResult: string; fields: ClovaField[] }>;
};

function isClovaResponse(v: unknown): v is ClovaResponse {
  if (typeof v !== 'object' || v === null) return false;
  return Array.isArray((v as Record<string, unknown>).images);
}

@Injectable()
export class OcrService {
  constructor(private readonly configService: ConfigService) {}

  async recognizeBill(file: Express.Multer.File): Promise<OcrResult> {
    const invokeUrl = this.configService.get<string>('CLOVA_OCR_INVOKE_URL');
    const secretKey = this.configService.get<string>('CLOVA_OCR_SECRET_KEY');

    if (!invokeUrl || !secretKey) {
      throw new HttpException(
        'CLOVA OCR 설정이 없습니다.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const format = ext === 'png' ? 'png' : ext === 'pdf' ? 'pdf' : 'jpg';

    const message = JSON.stringify({
      version: 'V2',
      requestId: randomUUID(),
      timestamp: 0,
      images: [{ format, name: 'bill' }],
    });

    const formData = new FormData();
    formData.append('message', message);
    formData.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );

    let response: Response;
    try {
      response = await fetch(invokeUrl, {
        method: 'POST',
        headers: { 'X-OCR-SECRET': secretKey },
        body: formData,
      });
    } catch {
      throw new HttpException(
        'CLOVA OCR 서비스에 연결할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        '이미지를 인식할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const data: unknown = await response.json();

    if (!isClovaResponse(data) || data.images[0]?.inferResult !== 'SUCCESS') {
      throw new HttpException(
        'OCR 인식에 실패했습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const fields = data.images[0].fields;

    // 읽기 순서 정렬 (위→아래, 좌→우)
    const sorted = [...fields].sort((a, b) => {
      const ay = Math.round(
        ((a.boundingPoly.vertices[0]?.y ?? 0) +
          (a.boundingPoly.vertices[2]?.y ?? 0)) /
          2 /
          25,
      );
      const by = Math.round(
        ((b.boundingPoly.vertices[0]?.y ?? 0) +
          (b.boundingPoly.vertices[2]?.y ?? 0)) /
          2 /
          25,
      );
      if (ay !== by) return ay - by;
      return (
        (a.boundingPoly.vertices[0]?.x ?? 0) -
        (b.boundingPoly.vertices[0]?.x ?? 0)
      );
    });

    // lineBreak 기준으로 줄 합치기
    const lines: string[] = [];
    let current: string[] = [];
    for (const field of sorted) {
      current.push(field.inferText);
      if (field.lineBreak) {
        lines.push(current.join(' '));
        current = [];
      }
    }
    if (current.length > 0) lines.push(current.join(' '));

    const words: OcrWord[] = sorted.map((f) => ({
      text: f.inferText,
      confidence: f.inferConfidence,
    }));

    const avgConfidence =
      words.length > 0
        ? words.reduce((s, w) => s + w.confidence, 0) / words.length
        : 0;

    return { text: lines.join('\n'), confidence: avgConfidence, words };
  }
}
