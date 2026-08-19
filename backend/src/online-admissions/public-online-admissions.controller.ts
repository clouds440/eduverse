import { Body, Controller, Get, Headers, Ip, Param, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { OnlineAdmissionsService } from './online-admissions.service';
import { CreateOnlineAdmissionSubmissionDto } from './dto/online-admission.dto';
import { ParseOnlineAdmissionSubmissionPipe } from './pipes/parse-online-admission-submission.pipe';

@Public()
@Controller('public/online-admissions')
export class PublicOnlineAdmissionsController {
  constructor(private readonly admissions: OnlineAdmissionsService) {}

  @Get('organizations')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  organizations(@Query('search') search?: string) {
    return this.admissions.listPublicOrganizations(search?.trim() || undefined);
  }

  @Get('organizations/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  organization(@Param('slug') slug: string) {
    return this.admissions.getPublicOrganization(slug);
  }

  @Get('offerings/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  offering(@Param('id') id: string) {
    return this.admissions.getPublicOffering(id);
  }

  @Get('submissions/update/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateSubmission(@Param('token') token: string) {
    return this.admissions.getPublicUpdateSubmission(token);
  }

  @Post('submissions/update/:token/documents')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @UseInterceptors(AnyFilesInterceptor())
  uploadUpdateDocuments(
    @Param('token') token: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.admissions.uploadPublicUpdateDocuments(token, files);
  }

  @Post('offerings/:id/submissions')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UseInterceptors(AnyFilesInterceptor())
  submit(
    @Param('id') id: string,
    @Body(ParseOnlineAdmissionSubmissionPipe) dto: unknown,
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Ip() ip?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.admissions.submitPublicApplication(
      id,
      dto as CreateOnlineAdmissionSubmissionDto,
      { ip, userAgent },
      files,
    );
  }
}
