import { Global, Module } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';

@Global()
@Module({
  providers: [EmailTemplateService],
  exports: [EmailTemplateService],
})
export class EmailTemplatesModule {}
