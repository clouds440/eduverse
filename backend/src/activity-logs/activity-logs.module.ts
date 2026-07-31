import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogMapperService } from './activity-log-mapper.service';
import { OrganizationActivityService } from './organization-activity.service';
import { PlatformActivityService } from './platform-activity.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    ActivityLogMapperService,
    OrganizationActivityService,
    PlatformActivityService,
  ],
  exports: [
    ActivityLogMapperService,
    OrganizationActivityService,
    PlatformActivityService,
  ],
})
export class ActivityLogsModule {}
