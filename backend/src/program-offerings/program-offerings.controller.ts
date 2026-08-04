import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProgramOfferingsService } from './program-offerings.service';

@Public()
@Controller('public/organizations/:slug/program-offerings')
export class ProgramOfferingsController {
  constructor(private readonly offerings: ProgramOfferingsService) {}

  @Get()
  list(@Param('slug') slug: string) {
    return this.offerings.list(slug);
  }
}
