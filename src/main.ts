import type { Server } from 'http';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import {
  createDevLatencyMiddleware,
  readDevLatencyConfig,
} from '@infrastructure/http/dev-latency.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  const latency = readDevLatencyConfig();
  if (latency) {
    app.use(createDevLatencyMiddleware(latency));
    logger.warn(
      `Dev HTTP latency enabled: ${latency.latencyMs}ms` +
        (latency.jitterMs > 0 ? ` + up to ${latency.jitterMs}ms jitter` : ''),
    );
  }

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Nuvi API')
    .setDescription('API de agenda y agente WhatsApp multi-tenant')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/swagger', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // The event stream of the panel stays open for hours, and two Node defaults would end it with no error
  // on either side: `requestTimeout` closes any request older than five minutes, and `keepAliveTimeout`
  // is shorter than the idle timeout of most proxies, which loses the race and surfaces as ECONNRESET.
  // `headersTimeout` has to stay above `keepAliveTimeout` or it fires first.
  const server = app.getHttpServer() as Server;
  server.requestTimeout = 0;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;

  logger.log(`App running on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Bootstrap failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
