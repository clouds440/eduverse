import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt as secureRandomInt, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { HumanVerificationAnswer, HumanVerificationPurpose } from './human-verification.types';

const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class HumanVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createChallenge(purpose: HumanVerificationPurpose) {
    const left = this.randomInt(2, 12);
    const operation = this.randomInt(0, 2);
    const right = operation === 1 ? this.randomInt(2, left) : this.randomInt(2, 9);
    const answer = operation === 0 ? left + right : operation === 1 ? left - right : left * right;
    const symbol = operation === 0 ? '+' : operation === 1 ? '-' : 'x';
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const challengeId = randomUUID();
    const challenge = await this.prisma.humanVerificationChallenge.create({
      data: {
        id: challengeId,
        purpose,
        answerHash: this.hashAnswer(challengeId, String(answer)),
        expiresAt,
      },
      select: { id: true },
    });
    void this.prisma.humanVerificationChallenge.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
    }).catch(() => undefined);
    return {
      challengeId: challenge.id,
      prompt: `${left} ${symbol} ${right} = ?`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verify(purpose: HumanVerificationPurpose, answer: HumanVerificationAnswer) {
    const challengeId = answer.challengeId?.trim();
    const normalizedAnswer = this.normalizeAnswer(answer.challengeAnswer);
    if (!challengeId || !normalizedAnswer) {
      throw new BadRequestException('Complete the human verification challenge');
    }
    const challenge = await this.prisma.humanVerificationChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.purpose !== purpose || challenge.usedAt || challenge.expiresAt <= new Date()) {
      throw new BadRequestException('Human verification challenge is invalid or expired');
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Human verification challenge has too many attempts');
    }
    const actualHash = this.hashAnswer(challenge.id, normalizedAnswer);
    if (!this.safeEqual(actualHash, challenge.answerHash)) {
      await this.prisma.humanVerificationChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Human verification answer is incorrect');
    }
    const consumed = await this.prisma.humanVerificationChallenge.updateMany({
      where: {
        id: challenge.id,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_ATTEMPTS },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new BadRequestException('Human verification challenge was already used');
    }
  }

  private normalizeAnswer(value?: string) {
    return value?.trim().toLowerCase().replace(/\s+/g, '') || '';
  }

  private hashAnswer(id: string, answer: string) {
    const secret = this.config.get<string>('HUMAN_VERIFICATION_SECRET')
      || this.config.get<string>('JWT_SECRET');
    if (!secret) throw new InternalServerErrorException('Human verification secret is not configured');
    return createHmac('sha256', secret).update(`${id}:${answer}`).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private randomInt(min: number, max: number) {
    return secureRandomInt(min, max + 1);
  }
}
