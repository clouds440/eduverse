import { BadRequestException } from '@nestjs/common';
import { BadWordsPipe } from './bad-words.pipe';

describe('BadWordsPipe', () => {
  const pipe = new BadWordsPipe();
  const bodyMetadata = { type: 'body' as const, metatype: undefined, data: undefined };

  it('skips technical id fields in nested import preview rows', () => {
    const value = {
      rows: [
        {
          data: {
            buildingId: 'shit',
            departmentIds: ['fuck'],
          },
        },
      ],
    };

    expect(pipe.transform(value, bodyMetadata)).toBe(value);
  });

  it('still blocks profanity in user-entered text fields', () => {
    expect(() => pipe.transform({ name: 'This is shit' }, bodyMetadata)).toThrow(BadRequestException);
  });

  it('skips structured numeric strings that can resemble leetspeak profanity', () => {
    const value = {
      rows: [
        {
          raw: {
            mapX: '455',
            mapY: '320',
          },
        },
      ],
    };

    expect(pipe.transform(value, bodyMetadata)).toBe(value);
  });

  it('returns the matched blocked word in profanity errors', () => {
    try {
      pipe.transform({ name: 'This is shit' }, bodyMetadata);
      throw new Error('Expected profanity validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        code: 'PROFANITY_DETECTED',
        field: 'name',
        matches: ['shit'],
        message: 'Profanity is not allowed in "name" ("shit"). Please revise it before submitting.',
      });
    }
  });
});
