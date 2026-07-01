import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Runs every hour to check for assessments due in exactly 24 hours (+/- 30 mins window).
   * This ensures students get a single notification one day before the deadline.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkDueSoonAssessment() {
    const now = new Date();
    const tomorrowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    // Find assessments due in the next 23.5 to 24.5 hours
    const assessments = await this.prisma.assessment.findMany({
      where: {
        dueDate: {
          gte: tomorrowStart,
          lte: tomorrowEnd,
        },
      },
      include: {
        section: {
          include: {
            enrollments: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const assessment of assessments) {
      const enrollments = assessment.section.enrollments;

      for (const enrollment of enrollments) {
        const studentUser = enrollment.student.user;

        await this.notifications.createNotificationOnce(
          {
            userId: studentUser.id,
            title: 'Assignment Due Soon',
            body: `Reminder: Your assessment "${assessment.title}" is due in 24 hours.`,
            type: 'ASSESSMENT_DUE_SOON',
            actionUrl: `/assessments/${assessment.id}`,
            metadata: { assessmentId: assessment.id },
          },
          { assessmentId: assessment.id },
          { includeActionUrlFallback: true },
        );
      }
    }
  }

  /**
   * Runs every hour to check for assessments that are overdue (due date has passed).
   * Notifies students who haven't submitted and teachers about missing submissions.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkOverdueAssessments() {
    const now = new Date();

    // Find assessments where due date has passed
    const assessments = await this.prisma.assessment.findMany({
      where: {
        dueDate: {
          lt: now,
        },
      },
      include: {
        section: {
          include: {
            enrollments: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
            teachers: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    for (const assessment of assessments) {
      const enrollments = assessment.section.enrollments;

      // Find students who haven't submitted this assessment
      const submissions = await this.prisma.submission.findMany({
        where: { assessmentId: assessment.id },
        select: { studentId: true },
      });

      const submittedStudentIds = new Set(submissions.map(s => s.studentId));
      const missingSubmissions = enrollments.filter(
        e => !submittedStudentIds.has(e.studentId)
      );

      // Notify students who haven't submitted
      for (const enrollment of missingSubmissions) {
        const studentUser = enrollment.student.user;

        await this.notifications.createNotificationOnce(
          {
            userId: studentUser.id,
            title: 'Assessment Overdue',
            body: `Your assessment "${assessment.title}" is overdue. Please provide an excuse or submit your work as soon as possible.`,
            type: 'ASSESSMENT_OVERDUE',
            actionUrl: `/student/${studentUser.id}?tab=assessments&assessmentId=${assessment.id}`,
            metadata: { assessmentId: assessment.id },
          },
          { assessmentId: assessment.id },
          { includeActionUrlFallback: true },
        );
      }

      // Notify teachers about missing submissions (only if there are missing submissions)
      if (missingSubmissions.length > 0) {
        for (const teacher of assessment.section.teachers) {
          const studentNames = missingSubmissions
            .map(e => e.student.user.name)
            .join(', ');

          await this.notifications.createNotificationOnce(
            {
              userId: teacher.user.id,
              title: 'Assessment Overdue - Missing Submissions',
              body: `${missingSubmissions.length} student(s) have not submitted "${assessment.title}": ${studentNames}`,
              type: 'ASSESSMENT_OVERDUE_TEACHER',
              actionUrl: `/sections/${assessment.sectionId}/assessments/${assessment.id}`,
              metadata: {
                assessmentId: assessment.id,
                sectionId: assessment.sectionId,
              },
            },
            { assessmentId: assessment.id, sectionId: assessment.sectionId },
            { includeActionUrlFallback: true },
          );
        }
      }
    }
  }
}
