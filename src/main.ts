import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpLogger = new Logger('HTTP');
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on('finish', () => {
      const status = response.statusCode;
      const message = `${request.method} ${request.path} ${status} ${Date.now() - startedAt}ms`;
      if (status >= 500) httpLogger.error(message);
      else if (status >= 400) httpLogger.warn(message);
      else httpLogger.log(message);
    });
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Biman GSE Digital Logbook API')
    .setDescription(
      'API for equipment, maintenance tickets, schedules, requests, files, and notifications.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API server running at http://localhost:${port}/api`);
  console.log(`Swagger UI available at http://localhost:${port}/api/docs`);
}

void bootstrap();
