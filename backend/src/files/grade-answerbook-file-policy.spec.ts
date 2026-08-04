import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { classifyAndValidateUpload, GRADE_ANSWERBOOK_ENTITY_TYPE } from './file-upload-policy';
import { FilesService } from './files.service';

function upload(name: string, mimetype: string, size: number): Express.Multer.File {
  const buffer = Buffer.alloc(Math.min(size, 16), 1);
  return { originalname: name, mimetype, size, buffer } as Express.Multer.File;
}

describe('grade answerbook file policy', () => {
  it.each([
    ['book.pdf', 'application/pdf'],
    ['page.jpg', 'image/jpeg'],
    ['page.jpeg', 'image/jpeg'],
    ['page.png', 'image/png'],
    ['page.webp', 'image/webp'],
  ])('accepts %s', (name, mimetype) => {
    const file = upload(name, mimetype, 1024);
    expect(classifyAndValidateUpload(file, GRADE_ANSWERBOOK_ENTITY_TYPE, createHash('sha256').update(file.buffer).digest('hex')))
      .toMatchObject({ sha256: expect.any(String) });
  });

  it('rejects unsupported answerbook documents', () => {
    const file = upload('book.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024);
    expect(() => classifyAndValidateUpload(file, GRADE_ANSWERBOOK_ENTITY_TYPE, 'hash')).toThrow(BadRequestException);
  });

  it('rejects oversized answerbook images', () => {
    const file = upload('page.png', 'image/png', 5 * 1024 * 1024 + 1);
    expect(() => classifyAndValidateUpload(file, GRADE_ANSWERBOOK_ENTITY_TYPE, 'hash')).toThrow(BadRequestException);
  });

  it('rejects oversized answerbook PDFs', () => {
    const file = upload('book.pdf', 'application/pdf', 50 * 1024 * 1024 + 1);
    expect(() => classifyAndValidateUpload(file, GRADE_ANSWERBOOK_ENTITY_TYPE, 'hash')).toThrow(BadRequestException);
  });

  it('blocks generic answerbook uploads before storage', async () => {
    const service = new FilesService({} as never);
    await expect(service.saveFile(
      { orgId: 'org-1', entityType: GRADE_ANSWERBOOK_ENTITY_TYPE, entityId: 'grade-1' },
      upload('book.pdf', 'application/pdf', 1024),
      'teacher-1',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks generic metadata access to answerbook evidence', async () => {
    const service = new FilesService({
      file: { findUnique: jest.fn().mockResolvedValue({ id: 'file-1', orgId: 'org-1', entityType: GRADE_ANSWERBOOK_ENTITY_TYPE, entityId: 'grade-1' }) },
    } as never);
    await expect(service.getFileMetadata('file-1', {
      id: 'admin-1', role: 'ORG_ADMIN', organizationId: 'org-1',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
