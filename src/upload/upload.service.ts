import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('AWS_REGION') ?? 'ap-northeast-2';
    const bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME');

    if (bucket) {
      this.bucket = bucket;
      this.s3 = new S3Client({
        region,
        credentials: {
          accessKeyId:
            this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey:
            this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
        },
      });
    } else {
      this.bucket = null;
      this.s3 = null;
    }
  }

  isAvailable(): boolean {
    return this.s3 !== null && this.bucket !== null;
  }

  private requireS3(): { s3: S3Client; bucket: string } {
    if (!this.s3 || !this.bucket) {
      throw new HttpException(
        'S3가 설정되지 않았습니다.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { s3: this.s3, bucket: this.bucket };
  }

  // 프론트엔드가 S3에 직접 PUT할 수 있는 Presigned URL 발급
  // 유효시간 5분 — 그 안에 업로드를 완료해야 한다.
  async createPresignedUploadUrl(
    originalFilename: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    const { s3, bucket } = this.requireS3();
    const ext = originalFilename.split('.').pop() ?? 'jpg';
    const key = `bills/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    return { uploadUrl, key };
  }

  async downloadFileBuffer(
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const { s3, bucket } = this.requireS3();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    let response: GetObjectCommandOutput;
    try {
      response = await s3.send(command);
    } catch {
      throw new HttpException(
        'S3에서 파일을 가져올 수 없습니다.',
        HttpStatus.NOT_FOUND,
      );
    }

    const body = response.Body as AsyncIterable<Uint8Array> | undefined;
    if (!body) {
      throw new HttpException(
        'S3 응답 본문이 비어 있습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of body) {
      chunks.push(chunk);
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: response.ContentType ?? 'application/octet-stream',
    };
  }
}
