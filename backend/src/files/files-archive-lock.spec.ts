import { ForbiddenException } from '@nestjs/common';
import { FilesService } from './files.service';

describe('FilesService archive lock', () => {
  it('denies deletion before calling storage or deleting metadata', async () => {
    const prisma = {
      file: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'file-1',
          orgId: 'org-1',
          entityType: 'COURSE_MATERIAL',
          entityId: 'material-1',
          lockedByArchiveId: 'archive-1',
          publicId: 'stored/file-1',
        }),
        delete: jest.fn(),
      },
    };
    const service = new FilesService(prisma as never);

    await expect(service.deleteFile('file-1', {
      id: 'admin-1',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.file.delete).not.toHaveBeenCalled();
  });
});
