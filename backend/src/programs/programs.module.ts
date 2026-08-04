import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GpaModule } from '../gpa/gpa.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  imports: [PrismaModule, GpaModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
