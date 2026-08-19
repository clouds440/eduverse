import { BadRequestException } from '@nestjs/common';
import { ParseOnlineAdmissionSubmissionPipe } from './parse-online-admission-submission.pipe';

describe('ParseOnlineAdmissionSubmissionPipe', () => {
  const pipe = new ParseOnlineAdmissionSubmissionPipe();
  const payload = {
    answers: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
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

  it('rejects missing application answers', async () => {
    await expect(pipe.transform({ payload: JSON.stringify({ captchaToken: 'captcha-token' }) })).rejects.toBeInstanceOf(BadRequestException);
  });
});
