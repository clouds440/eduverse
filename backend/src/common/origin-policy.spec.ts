import { configuredOrigins, isAllowedOrigin } from './origin-policy';

describe('origin policy', () => {
  it('normalizes and deduplicates configured frontend origins', () => {
    expect(
      configuredOrigins(
        'https://school.example/path, https://school.example, http://localhost:3001',
      ),
    ).toEqual(['https://school.example', 'http://localhost:3001']);
  });

  it('uses exact origins and rejects lookalike or malformed values', () => {
    const allowed = ['https://school.example'];
    expect(isAllowedOrigin('https://school.example', allowed)).toBe(true);
    expect(isAllowedOrigin('https://school.example/login', allowed)).toBe(true);
    expect(
      isAllowedOrigin('https://school.example.attacker.test', allowed),
    ).toBe(false);
    expect(isAllowedOrigin('not-a-url', allowed)).toBe(false);
  });

  it('allows originless non-browser requests', () => {
    expect(isAllowedOrigin(undefined, [])).toBe(true);
  });

  it('rejects non-http frontend URL protocols', () => {
    expect(() => configuredOrigins('file:///tmp/frontend')).toThrow(
      'Unsupported frontend URL protocol',
    );
  });
});
