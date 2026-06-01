import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: () => {
        const storage = new CloudinaryStorage({
          cloudinary: cloudinary,
          params: (req: any, _file: any) => {
            const { orgId, entityType, entityId } = req.body;
            const safeOrg = orgId ?? 'unknown';
            const safeEntity = entityType ?? 'unknown';
            const safeEntityId = entityId ?? 'unknown';

            // Extract filename without extension for public_id
            const fileName = _file.originalname
              .replace(/\s+/g, '-')
              .split('.')
              .slice(0, -1)
              .join('.');
            const uniquePublicId = `${Date.now()}-${fileName}`;

            return {
              folder: `eduverse/orgs/${safeOrg}/${safeEntity}/${safeEntityId}`,
              resource_type: 'auto',
              public_id: uniquePublicId,
            };
          },
        });
        return { storage };
      },
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
