import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EducationProvidersModule } from '../education-providers/education-providers.module';
import { AdmissionFormsController } from './admission-forms.controller';
import { AdmissionFormsService } from './admission-forms.service';

@Module({
  imports: [PrismaModule, EducationProvidersModule],
  controllers: [AdmissionFormsController],
  providers: [AdmissionFormsService],
  exports: [AdmissionFormsService],
})
export class AdmissionFormsModule {}
