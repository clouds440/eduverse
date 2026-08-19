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

  @Get('offerings')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  offerings(
    @Query('search') search?: string,
    @Query('providerSlug') providerSlug?: string,
    @Query('programType') programType?: string,
    @Query('subject') subject?: string,
    @Query('location') location?: string,
    @Query('onlineOnly') onlineOnly?: string,
    @Query('minFee') minFee?: string,
    @Query('maxFee') maxFee?: string,
    @Query('intake') intake?: string,
    @Query('deadlineBefore') deadlineBefore?: string,
  ) {
    return this.admissions.listPublicOfferings({
      search: search?.trim() || undefined,
      providerSlug: providerSlug?.trim() || undefined,
      programType: programType?.trim() || undefined,
      subject: subject?.trim() || undefined,
      location: location?.trim() || undefined,
      onlineOnly: onlineOnly === 'true',
      minFee: minFee ? Number(minFee) : undefined,
      maxFee: maxFee ? Number(maxFee) : undefined,
      intake: intake?.trim() || undefined,
      deadlineBefore: deadlineBefore?.trim() || undefined,
    });
  }

  @Get('providers/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  provider(@Param('slug') slug: string) {
    return this.admissions.getPublicProvider(slug);
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
    @Body('documentExpiryDates') documentExpiryDates?: string,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    let expiryDates: Record<string, string> = {};
    if (documentExpiryDates) {
      try {
        const parsed = JSON.parse(documentExpiryDates) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) expiryDates = parsed as Record<string, string>;
      } catch {
        expiryDates = {};
      }
    }
    return this.admissions.uploadPublicUpdateDocuments(token, files, expiryDates);
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
