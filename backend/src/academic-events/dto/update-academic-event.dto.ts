import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicEventDto } from './create-academic-event.dto';

export class UpdateAcademicEventDto extends PartialType(CreateAcademicEventDto) {}
