import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe,
} from '@nestjs/common';
import { CreateOnlineAdmissionSubmissionDto } from '../dto/online-admission.dto';

@Injectable()
export class ParseOnlineAdmissionSubmissionPipe implements PipeTransform {
  private readonly validator = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  async transform(value: unknown) {
    const parsed = this.parse(value);
    return this.validator.transform(parsed, {
      type: 'body',
      metatype: CreateOnlineAdmissionSubmissionDto,
    } as ArgumentMetadata);
  }

  private parse(value: unknown) {
    if (!value || typeof value !== 'object') return value;
    const body = value as Record<string, unknown>;
    if (typeof body.payload !== 'string') return body;
    try {
      return JSON.parse(body.payload) as unknown;
    } catch {
      throw new BadRequestException('Invalid submission payload');
    }
  }
}
