import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS는 nginx에서 처리 (504 등 에러 응답에도 헤더 포함하기 위해)
  // 로컬 개발 시에만 활성화
  if (process.env.NODE_ENV !== 'production') {
    app.enableCors({
      origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
        .split(',')
        .map((o) => o.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
  }

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('GLGC API').build(),
  );
  SwaggerModule.setup('api', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
