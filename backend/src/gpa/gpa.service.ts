import { BadRequestException, Injectable } from '@nestjs/common';
import { GpaCalculationMethod, GpaPolicy, GpaRounding, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STANDARD_GPA_RULES } from './gpa.constants';

const MARK_STEP = 0.01;
const MARK_EPSILON = 0.000001;

export interface GpaGradeRule {
  min: number;
  max: number;
  letter: string;
  points: number;
}

export interface GpaCourseInput {
  courseId?: string | null;
  courseName: string;
  sectionId?: string | null;
  sectionName?: string | null;
  creditHours: number;
  percentage: number;
  marksObtained?: number;
  totalMarks?: number;
}

export interface GpaCourseResult extends GpaCourseInput {
  letterGrade: string;
  gradePoints: number;
  qualityPoints: number;
}

export interface GpaSummary {
  gpa: number;
  totalCreditHours: number;
  policyName: string;
  gpaScale: number;
  method: GpaCalculationMethod;
  rounding: GpaRounding;
}

export interface GpaPolicySnapshot {
  policyId?: string;
  name: string;
  scale: number;
  method: GpaCalculationMethod;
  rounding: GpaRounding;
  gradeRules: GpaGradeRule[];
  capturedAt?: string;
}

type GpaPolicyLike = {
  name: string;
  scale: number;
  method: GpaCalculationMethod;
  rounding: GpaRounding;
  gradeRules: unknown;
};

@Injectable()
export class GpaService {
  constructor(private readonly prisma: PrismaService) {}

  private formatMark(value: number) {
    return Number(value.toFixed(2));
  }

  validateGradeRules(rules: GpaGradeRule[], scale: number) {
    if (!Array.isArray(rules) || rules.length === 0) {
      throw new BadRequestException('At least one GPA grade rule is required');
    }

    const normalized = rules.map((rule, index) => {
      const min = Number(rule.min);
      const max = Number(rule.max);
      const points = Number(rule.points);
      const letter = typeof rule.letter === 'string' ? rule.letter.trim() : '';

      if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(points)) {
        throw new BadRequestException(`Grade rule ${index + 1} must use numeric min, max, and points`);
      }
      if (!letter) {
        throw new BadRequestException(`Grade rule ${index + 1} must include a letter grade`);
      }
      if (min < 0 || max > 100 || min > max) {
        throw new BadRequestException(`Grade rule ${letter} must stay within 0-100 and have min <= max`);
      }
      if (points < 0 || points > scale) {
        throw new BadRequestException(`Grade points for ${letter} must be between 0 and the GPA scale`);
      }

      return { min, max, letter, points };
    }).sort((a, b) => a.min - b.min);

    if (normalized[0].min > 0) {
      throw new BadRequestException(`Grade rules must cover marks from 0 to 100. Missing 0-${this.formatMark(normalized[0].min - MARK_STEP)}`);
    }

    for (let index = 1; index < normalized.length; index++) {
      const previous = normalized[index - 1];
      const current = normalized[index];
      if (current.min <= previous.max) {
        throw new BadRequestException(`Grade ranges for ${previous.letter} and ${current.letter} overlap`);
      }
      if (current.min - previous.max > MARK_STEP + MARK_EPSILON) {
        throw new BadRequestException(`Grade rules must not skip mark ranges. Missing ${this.formatMark(previous.max + MARK_STEP)}-${this.formatMark(current.min - MARK_STEP)}`);
      }
      if (current.points < previous.points) {
        throw new BadRequestException(`Grade points cannot decrease as marks increase. ${current.letter} has fewer points than ${previous.letter}`);
      }
    }

    const lastRule = normalized[normalized.length - 1];
    if (lastRule.max < 100) {
      throw new BadRequestException(`Grade rules must cover marks from 0 to 100. Missing ${this.formatMark(lastRule.max + MARK_STEP)}-100`);
    }

    return normalized;
  }

  applyRounding(value: number, rounding: GpaRounding) {
    if (!Number.isFinite(value)) return 0;
    if (rounding === GpaRounding.ONE_DECIMAL) return Number(value.toFixed(1));
    if (rounding === GpaRounding.TWO_DECIMALS) return Number(value.toFixed(2));
    return value;
  }

  resolveGrade(percentage: number, rules: GpaGradeRule[]) {
    const score = Math.max(0, Math.min(100, Number(percentage)));
    const match = [...rules]
      .sort((a, b) => b.min - a.min)
      .find((rule) => score >= rule.min && score <= rule.max);

    return match
      ? { letterGrade: match.letter, gradePoints: match.points }
      : { letterGrade: 'N/A', gradePoints: 0 };
  }

  async getDefaultPolicy(orgId: string) {
    const existing = await this.prisma.gpaPolicy.findFirst({
      where: { organizationId: orgId, isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const firstPolicy = await this.prisma.gpaPolicy.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    if (firstPolicy) {
      return this.prisma.gpaPolicy.update({
        where: { id: firstPolicy.id },
        data: { isDefault: true },
      });
    }

    return this.prisma.gpaPolicy.create({
      data: {
        organizationId: orgId,
        name: 'Standard 4.0',
        scale: 4.0,
        method: GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS,
        rounding: GpaRounding.TWO_DECIMALS,
        gradeRules: STANDARD_GPA_RULES as unknown as Prisma.InputJsonValue,
        isDefault: true,
      },
    });
  }

  normalizePolicy(policy: GpaPolicyLike) {
    const rules = this.validateGradeRules(policy.gradeRules as unknown as GpaGradeRule[], policy.scale);
    return {
      name: policy.name,
      scale: policy.scale,
      method: policy.method,
      rounding: policy.rounding,
      gradeRules: rules,
    };
  }

  snapshotPolicy(policy: Pick<GpaPolicy, 'id'> & GpaPolicyLike): GpaPolicySnapshot {
    const normalized = this.normalizePolicy(policy);
    return {
      policyId: policy.id,
      name: normalized.name,
      scale: normalized.scale,
      method: normalized.method,
      rounding: normalized.rounding,
      gradeRules: normalized.gradeRules,
      capturedAt: new Date().toISOString(),
    };
  }

  normalizeSnapshot(snapshot: unknown): GpaPolicySnapshot | null {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const value = snapshot as Partial<GpaPolicySnapshot>;
    if (!value.name || value.scale === undefined || !value.method || !value.rounding || !value.gradeRules) return null;
    const normalized = this.normalizePolicy({
      name: value.name,
      scale: Number(value.scale),
      method: value.method,
      rounding: value.rounding,
      gradeRules: value.gradeRules as unknown as Prisma.JsonValue,
    });
    return {
      policyId: value.policyId,
      ...normalized,
      capturedAt: value.capturedAt,
    };
  }

  async getPolicyForCycle(orgId: string, cycle?: { gpaPolicySnapshot?: Prisma.JsonValue | null } | null) {
    const snapshot = this.normalizeSnapshot(cycle?.gpaPolicySnapshot);
    if (snapshot) return snapshot;
    const defaultPolicy = await this.getDefaultPolicy(orgId);
    return this.snapshotPolicy(defaultPolicy);
  }

  calculateCourses(
    courses: GpaCourseInput[],
    policy: GpaPolicyLike | GpaPolicySnapshot,
  ) {
    const normalizedPolicy = this.normalizePolicy(policy);
    const courseResults: GpaCourseResult[] = courses.map((course) => {
      const grade = this.resolveGrade(course.percentage, normalizedPolicy.gradeRules);
      const creditHours = Number(course.creditHours) > 0 ? Number(course.creditHours) : 0;
      const qualityPoints = grade.gradePoints * creditHours;
      return {
        ...course,
        creditHours,
        letterGrade: grade.letterGrade,
        gradePoints: grade.gradePoints,
        qualityPoints,
      };
    });

    const totalCreditHours = courseResults.reduce((sum, course) => sum + course.creditHours, 0);
    const gpa = normalizedPolicy.method === GpaCalculationMethod.WEIGHTED_BY_CREDIT_HOURS
      ? totalCreditHours > 0
        ? courseResults.reduce((sum, course) => sum + course.qualityPoints, 0) / totalCreditHours
        : 0
      : courseResults.length > 0
        ? courseResults.reduce((sum, course) => sum + course.gradePoints, 0) / courseResults.length
        : 0;

    return {
      courses: courseResults,
      summary: {
        gpa: this.applyRounding(gpa, normalizedPolicy.rounding),
        totalCreditHours: this.applyRounding(totalCreditHours, GpaRounding.TWO_DECIMALS),
        policyName: normalizedPolicy.name,
        gpaScale: normalizedPolicy.scale,
        method: normalizedPolicy.method,
        rounding: normalizedPolicy.rounding,
      } satisfies GpaSummary,
    };
  }
}
