import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Role } from './common/enums';
import * as bcrypt from 'bcrypt';
import { join } from 'path';
import { validateEnv } from './common/env-validation';
import { createPrismaClient } from './prisma/prisma-client';

async function bootstrap() {
  // Validate required environment variables before starting
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  const allowedOrigins = (process.env.FRONTEND_URL!)
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed =
        allowedOrigins.some((allowed) => origin === allowed) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /\.vercel\.app$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Serve uploaded files as static assets
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // Initialize Super Admin
  const prisma = createPrismaClient();
  const adminEmail = process.env.SUPER_ADMIN_USERNAME;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS!, 10);

  if (adminEmail && adminPassword) {
    const hashedPassword = await bcrypt.hash(adminPassword, bcryptRounds);

    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          role: Role.SUPER_ADMIN,
          avatarUrl: '/assets/eduverse-icon-192.png',
          isFirstLogin: true,
        },
      });
      logger.log('Initial Super Admin created successfully');
    }
  }
  await prisma.$disconnect();

  const port = process.env.PORT!;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
