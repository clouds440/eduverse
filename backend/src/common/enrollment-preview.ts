export interface EnrollmentPreviewStudent {
  registrationNumber?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}

export interface EnrollmentPreviewSection {
  name?: string | null;
  code?: string | null;
}

export interface MissingEnrollmentPreview {
  studentId: string;
  studentName: string;
  registrationNumber: string | null;
  sectionId: string;
  sectionName: string;
  sectionCode: string;
}

export function enrollmentPairKey(studentId: string, sectionId: string) {
  return `${studentId}:${sectionId}`;
}

export function buildMissingEnrollmentPreview({
  studentIds,
  sectionIds,
  existingPairs,
  studentById,
  sectionById,
}: {
  studentIds: string[];
  sectionIds: string[];
  existingPairs: Set<string>;
  studentById: Map<string, EnrollmentPreviewStudent | undefined>;
  sectionById: Map<string, EnrollmentPreviewSection | undefined>;
}): MissingEnrollmentPreview[] {
  return studentIds.flatMap((studentId) => sectionIds
    .filter((sectionId) => !existingPairs.has(enrollmentPairKey(studentId, sectionId)))
    .map((sectionId) => {
      const student = studentById.get(studentId);
      const section = sectionById.get(sectionId);
      return {
        studentId,
        studentName: student?.user?.name || student?.user?.email || 'Student',
        registrationNumber: student?.registrationNumber || null,
        sectionId,
        sectionName: section?.name || 'Section',
        sectionCode: section?.code || '',
      };
    }));
}
