import { GradeStatus } from '@/prisma/prisma-client';

export { GRADE_ANSWERBOOK_ENTITY_TYPE } from '../files/file-upload-policy';
export const MAX_GRADE_ANSWERBOOK_ATTACHMENTS = 5;

export type GradeEvidenceActor = {
  id: string;
  role: string;
};

export type GradeEvidenceFile = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  fileKind: string;
  extension: string | null;
  createdAt: Date;
};

export type GradeEvidenceAttachmentRecord = {
  id: string;
  gradeId: string;
  uploadedById: string;
  createdAt: Date;
  file: GradeEvidenceFile;
};

export function normalizeAnswerbookReference(value: string | null | undefined) {
  const normalized = value?.trim() || null;
  return normalized;
}

export function toPublicGradeEvidenceAttachment(record: GradeEvidenceAttachmentRecord) {
  return {
    id: record.id,
    gradeId: record.gradeId,
    uploadedById: record.uploadedById,
    createdAt: record.createdAt,
    file: {
      ...record.file,
      path: `/org/grades/${record.gradeId}/answerbook-attachments/${record.id}/download`,
    },
  };
}

export function isReleasedGradeStatus(status: GradeStatus) {
  return status === GradeStatus.PUBLISHED || status === GradeStatus.FINALIZED;
}
