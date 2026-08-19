import { Module } from '@nestjs/common';
import { EducationProvidersService } from './education-providers.service';

@Module({
  providers: [EducationProvidersService],
  exports: [EducationProvidersService],
})
export class EducationProvidersModule {}
