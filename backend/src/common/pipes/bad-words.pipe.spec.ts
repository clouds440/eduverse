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
});
