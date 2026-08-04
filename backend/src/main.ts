import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { validateEnv } from './common/env-validation';
import { createPrismaClient } from './prisma/prisma-client';
import { BadWordsPipe } from './common/pipes/bad-words.pipe';
import { configuredOrigins, isAllowedOrigin } from './common/origin-policy';
import { bootstrapSuperAdmin } from './bootstrap/super-admin.bootstrap';

async function bootstrap() {
  // Validate required environment variables before starting
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');
  app.set('trust proxy', 1);

  app.useBodyParser('json', {
    limit: '25mb',
    verify: (
      req: { originalUrl?: string; rawBody?: Buffer },
      _res,
      buf: Buffer,
    ) => {
      if (req.originalUrl === '/ai/billing/webhook') {
        req.rawBody = Buffer.from(buf);
      }
    },
  });
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });

  const allowedOrigins = configuredOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isAllowedOrigin(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new BadWordsPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Serve uploaded files as static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const prisma = createPrismaClient();
  try {
    await bootstrapSuperAdmin(prisma, process.env, logger);
  } finally {
    await prisma.$disconnect();
  }

  const port = process.env.PORT!;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
void bootstrap();
