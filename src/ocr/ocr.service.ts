import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OcrWord = { text: string; confidence: number };
export type OcrResult = { text: string; confidence: number; words: OcrWord[] };

function isOcrWord(value: unknown): value is OcrWord {
  if (typeof value !== 'object' || value === null) return false;
  const word = value as Record<string, unknown>;
  return typeof word.text === 'string' && typeof word.confidence === 'number';
}

function isOcrResult(value: unknown): value is OcrResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.text === 'string' &&
    typeof result.confidence === 'number' &&
    Array.isArray(result.words) &&
    result.words.every(isOcrWord)
  );
}

@Injectable()
export class OcrService {
  constructor(private readonly configService: ConfigService) {}

  async recognizeBill(file: Express.Multer.File): Promise<OcrResult> {
    const baseUrl =
      this.configService.get<string>('OCR_SERVICE_URL') ??
      'http://127.0.0.1:8000';

    const formData = new FormData();
    formData.set(
      'image',
      new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
      file.originalname,
    );

    let response: Response;

    try {
      response = await fetch(`${baseUrl}/recognize`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      throw new HttpException(
        'OCR 서비스에 연결할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      const status =
        response.status === 400
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.BAD_GATEWAY;

      throw new HttpException('이미지를 인식할 수 없습니다.', status);
    }

    const data: unknown = await response.json();

    if (!isOcrResult(data)) {
      throw new HttpException(
        'OCR 서비스 응답 형식이 올바르지 않습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return data;
  }
}
