import { Injectable } from '@nestjs/common';
import { EvaluationType, Prisma } from '@/prisma/prisma-client';
import { PrismaService } from '../prisma/prisma.service';

export interface EvaluationSummaryOptions {
  includeFeedback?: boolean;
  includeHiddenFeedback?: boolean;
  anonymizeFeedback?: boolean;
  limit?: number;
}

@Injectable()
export class EvaluationAggregationService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(where: Prisma.EvaluationWhereInput, options: EvaluationSummaryOptions = {}) {
    const [aggregate, distributionRows, feedbackRows] = await Promise.all([
      this.prisma.evaluation.aggregate({
        where,
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.prisma.evaluation.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
      options.includeFeedback
        ? this.prisma.evaluation.findMany({
            where: {
              ...where,
              feedback: { not: null },
              ...(options.includeHiddenFeedback ? {} : { isHidden: false }),
            },
            take: options.limit ?? 50,
            orderBy: { createdAt: 'desc' },
            include: {
              student: options.anonymizeFeedback
                ? false
                : { include: { user: { select: { id: true, name: true, email: true } } } },
              section: { select: { id: true, name: true } },
              course: { select: { id: true, name: true } },
              teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
              academicCycle: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distributionRows) {
      distribution[row.rating as 1 | 2 | 3 | 4 | 5] = row._count.rating;
    }

    return {
      averageRating: aggregate._avg.rating ? Number(aggregate._avg.rating.toFixed(2)) : null,
      totalRatings: aggregate._count.id,
      distribution,
      feedback: feedbackRows.map((evaluation) => ({
        id: evaluation.id,
        type: evaluation.type,
        rating: evaluation.rating,
        feedback: evaluation.feedback,
        isHidden: evaluation.isHidden,
        hiddenReason: evaluation.hiddenReason,
        createdAt: evaluation.createdAt,
        section: evaluation.section,
        course: evaluation.course,
        teacher: evaluation.teacher,
        academicCycle: evaluation.academicCycle,
        student: options.anonymizeFeedback ? null : evaluation.student,
      })),
    };
  }

  summaryWhereForTeacher(orgId: string, teacherId: string, extra: Prisma.EvaluationWhereInput = {}) {
    return {
      organizationId: orgId,
      type: EvaluationType.TEACHER,
      teacherId,
      ...extra,
    } satisfies Prisma.EvaluationWhereInput;
  }

  summaryWhereForCourse(orgId: string, courseId: string, extra: Prisma.EvaluationWhereInput = {}) {
    return {
      organizationId: orgId,
      type: EvaluationType.COURSE,
      courseId,
      ...extra,
    } satisfies Prisma.EvaluationWhereInput;
  }
}
