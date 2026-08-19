import { BadRequestException } from '@nestjs/common';
import { ParseOnlineAdmissionSubmissionPipe } from './parse-online-admission-submission.pipe';

describe('ParseOnlineAdmissionSubmissionPipe', () => {
  const pipe = new ParseOnlineAdmissionSubmissionPipe();
  const payload = {
    applicantName: 'Ada Lovelace',
    applicantEmail: 'ada@example.com',
    formData: {},
    captchaToken: 'captcha-token',
  };

  it('parses and validates multipart JSON payloads', async () => {
    await expect(pipe.transform({ payload: JSON.stringify(payload) })).resolves.toEqual(payload);
  });

  it('validates ordinary JSON request bodies through the same path', async () => {
    await expect(pipe.transform(payload)).resolves.toEqual(payload);
  });

  it('rejects malformed multipart payloads', async () => {
    await expect(pipe.transform({ payload: '{invalid' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing required applicant fields', async () => {
    await expect(pipe.transform({ payload: JSON.stringify({ formData: {} }) })).rejects.toBeInstanceOf(BadRequestException);
  });
});
