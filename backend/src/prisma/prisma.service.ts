import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@/prisma/prisma-client';
import { createPrismaClientOptions } from './prisma-client';

interface SchemaCapabilities {
  programRollout: boolean;
  courseResultRelationships: boolean;
  sectionComponentType: boolean;
  enrollmentProgramContext: boolean;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private schemaCapabilities?: Promise<SchemaCapabilities>;

  constructor() {
    super(createPrismaClientOptions());
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async getSchemaCapabilities(): Promise<SchemaCapabilities> {
    if (!this.schemaCapabilities) {
      this.schemaCapabilities = this.loadSchemaCapabilities();
    }
    return this.schemaCapabilities;
  }

  async hasProgramRolloutSchema() {
    return (await this.getSchemaCapabilities()).programRollout;
  }

  async hasEnrollmentProgramContext() {
    return (await this.getSchemaCapabilities()).enrollmentProgramContext;
  }

  async hasCourseResultRelationshipSchema() {
    return (await this.getSchemaCapabilities()).courseResultRelationships;
  }

  private async loadSchemaCapabilities(): Promise<SchemaCapabilities> {
    const rows = await this.$queryRaw<Array<{ kind: 'table' | 'column'; name: string }>>`
      SELECT 'table'::text AS kind, table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'ProgramOffering',
          'ProgramStageOffering',
          'CohortOffering',
          'CohortOfferingSection',
          'StudentCohortMembership',
          'StudentProgramEnrollment',
          'StudentStageEnrollment',
          'CourseResultScheme',
          'CourseResultComponent',
          'CourseResultComponentSection'
        )
      UNION ALL
      SELECT 'column'::text AS kind, table_name || '.' || column_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'Program' AND column_name = 'minimumPassingPercentage')
          OR (table_name = 'Section' AND column_name = 'componentType')
          OR (table_name = 'Enrollment' AND column_name IN (
            'studentProgramEnrollmentId',
            'studentStageEnrollmentId',
            'studentCohortMembershipId'
          ))
        )
    `;
    const available = new Set(rows.map((row) => row.name));
    return {
      programRollout: [
        'ProgramOffering',
        'ProgramStageOffering',
        'CohortOffering',
        'CohortOfferingSection',
        'StudentCohortMembership',
        'StudentProgramEnrollment',
        'StudentStageEnrollment',
        'Program.minimumPassingPercentage',
        'Enrollment.studentProgramEnrollmentId',
        'Enrollment.studentStageEnrollmentId',
        'Enrollment.studentCohortMembershipId',
      ].every((name) => available.has(name)),
      courseResultRelationships: [
        'CourseResultScheme',
        'CourseResultComponent',
        'CourseResultComponentSection',
      ].every((name) => available.has(name)),
      sectionComponentType: available.has('Section.componentType'),
      enrollmentProgramContext: [
        'Enrollment.studentProgramEnrollmentId',
        'Enrollment.studentStageEnrollmentId',
        'Enrollment.studentCohortMembershipId',
      ].every((name) => available.has(name)),
    };
  }
}
