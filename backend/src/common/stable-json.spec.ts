import { stableJsonStringify } from './stable-json';

describe('stableJsonStringify', () => {
  it('preserves array order while ignoring object key insertion order', () => {
    const first = {
      z: 1,
      nested: { b: 2, a: 1 },
      rows: [
        { id: 'one', value: 1 },
        { value: 2, id: 'two' },
      ],
    };
    const reordered = {
      rows: [
        { value: 1, id: 'one' },
        { id: 'two', value: 2 },
      ],
      nested: { a: 1, b: 2 },
      z: 1,
    };

    expect(stableJsonStringify(first)).toBe(stableJsonStringify(reordered));
    expect(stableJsonStringify({ rows: [1, 2] })).not.toBe(
      stableJsonStringify({ rows: [2, 1] }),
    );
  });
});
