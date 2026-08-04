import { createHash } from 'crypto';
import { ConflictException } from '@nestjs/common';
import {
  AcademicCycleArchiveStatus,
  AcademicCycleStatus,
  StudentProgramCycleStatus,
} from '@/prisma/prisma-client';
import { AcademicCycleArchivesService } from './academic-cycle-archives.service';
import { stableJsonStringify } from '../common/stable-json';

const hash = (value: unknown) =>
  createHash('sha256').update(stableJsonStringify(value)).digest('hex');

describe('AcademicCycleArchivesService', () => {
  it('blocks archive creation while a program cycle is still in progress', async () => {
    const prisma = {
      academicCycle: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'cycle-1',
            status: AcademicCycleStatus.COMPLETED,
          }),
      },
      studentProgramEnrollmentCycle: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new AcademicCycleArchivesService(
      prisma as never,
      {} as never,
    );

    await expect(
      (service as any).preflight('org-1', 'cycle-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.studentProgramEnrollmentCycle.count).toHaveBeenCalledWith({
      where: {
        academicCycleId: 'cycle-1',
        status: StudentProgramCycleStatus.IN_PROGRESS,
      },
    });
  });

  it('restarts a failed revision idempotently after clearing only its partial snapshot rows', async () => {
    const latest = {
      id: 'archive-1',
      revision: 1,
      status: AcademicCycleArchiveStatus.FAILED,
    };
    const tx = {
      academicCycle: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'cycle-1',
            status: AcademicCycleStatus.ARCHIVING,
            archives: [latest],
          }),
      },
      academicCycleArchiveSectionProgramIndex: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      academicCycleArchiveStudentIndex: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      academicCycleArchiveSection: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      academicCycleArchive: {
        update: jest
          .fn()
          .mockResolvedValue({
            ...latest,
            status: AcademicCycleArchiveStatus.BUILDING,
          }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: unknown) => unknown) =>
        operation(tx),
      ),
    };
    const service = new AcademicCycleArchivesService(
      prisma as never,
      {} as never,
    );

    await (service as any).start('org-1', 'cycle-1', 'admin-1', true);

    expect(
      tx.academicCycleArchiveSectionProgramIndex.deleteMany,
    ).toHaveBeenCalledWith({ where: { archiveId: 'archive-1' } });
    expect(tx.academicCycleArchiveStudentIndex.deleteMany).toHaveBeenCalledWith(
      { where: { archiveId: 'archive-1' } },
    );
    expect(tx.academicCycleArchiveSection.deleteMany).toHaveBeenCalledWith({
      where: { archiveId: 'archive-1' },
    });
    expect(tx.academicCycleArchive.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'archive-1' },
        data: expect.objectContaining({
          status: AcademicCycleArchiveStatus.BUILDING,
          failureReason: null,
          checksum: null,
        }),
      }),
    );
  });

  it('rejects a retry while another build is marked running', async () => {
    const tx = {
      academicCycle: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'cycle-1',
            status: AcademicCycleStatus.ARCHIVING,
            archives: [
              { id: 'archive-1', status: AcademicCycleArchiveStatus.BUILDING },
            ],
          }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: unknown) => unknown) =>
        operation(tx),
      ),
    };
    const service = new AcademicCycleArchivesService(
      prisma as never,
      {} as never,
    );

    await expect(
      (service as any).start('org-1', 'cycle-1', 'admin-1', true),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects archive finalization when a referenced file has no checksum', async () => {
    const tx = { file: { count: jest.fn().mockResolvedValue(1) } };
    const service = new AcademicCycleArchivesService({} as never, {} as never);

    await expect(
      (service as any).assertFilesVerifiable(tx, 'org-1', ['file-1']),
    ).rejects.toThrow('Archive contains 1 file(s) without a SHA-256 checksum');
    expect(tx.file.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['file-1'] },
        orgId: 'org-1',
        OR: [{ sha256: null }, { sha256: '' }],
      },
    });
  });

  it('verifies payload checksums, archive checksum, section count, and locked file set', async () => {
    const payload = { schemaVersion: 1, section: { id: 'section-1' } };
    const sectionChecksum = hash(payload);
    const archiveChecksum = hash([
      { sectionId: 'section-1', checksum: sectionChecksum },
    ]);
    const prisma = {
      academicCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-1',
          currentArchive: {
            id: 'archive-1',
            revision: 1,
            schemaVersion: 1,
            checksum: archiveChecksum,
            manifest: {
              sections: [{ sectionId: 'section-1', checksum: sectionChecksum }],
              fileIds: ['file-1'],
            },
            sections: [
              { sourceSectionId: 'section-1', sectionChecksum, payload },
            ],
            lockedFiles: [{ id: 'file-1' }],
          },
        }),
      },
    };
    const service = new AcademicCycleArchivesService(
      prisma as never,
      {} as never,
    );

    await expect(
      service.verifyCurrent('org-1', 'cycle-1'),
    ).resolves.toMatchObject({
      valid: true,
      sectionChecksumsMatch: true,
      archiveChecksumMatches: true,
      filesLocked: true,
      expectedSections: 1,
      actualSections: 1,
    });
  });

  it('reports verification failure when a snapshotted payload changes', async () => {
    const originalChecksum = hash({ untouched: true });
    const prisma = {
      academicCycle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'cycle-1',
          currentArchive: {
            id: 'archive-1',
            revision: 1,
            schemaVersion: 1,
            checksum: hash([
              { sectionId: 'section-1', checksum: originalChecksum },
            ]),
            manifest: {
              sections: [
                { sectionId: 'section-1', checksum: originalChecksum },
              ],
              fileIds: [],
            },
            sections: [
              {
                sourceSectionId: 'section-1',
                sectionChecksum: originalChecksum,
                payload: { changed: true },
              },
            ],
            lockedFiles: [],
          },
        }),
      },
    };
    const service = new AcademicCycleArchivesService(
      prisma as never,
      {} as never,
    );

    await expect(
      service.verifyCurrent('org-1', 'cycle-1'),
    ).resolves.toMatchObject({ valid: false, sectionChecksumsMatch: false });
  });
});
