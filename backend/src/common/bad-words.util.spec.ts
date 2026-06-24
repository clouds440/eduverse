import { checkBadWords } from './bad-words.util';

describe('bad words util', () => {
  it('allows normal school text', () => {
    expect(checkBadWords('Class assignment feedback looks good.').okay).toBe(true);
  });

  it('blocks direct inappropriate words', () => {
    expect(checkBadWords('This is shit').okay).toBe(false);
  });

  it('blocks separated inappropriate words', () => {
    expect(checkBadWords('f u c k').okay).toBe(false);
  });

  it('does not block clean words that merely share a prefix', () => {
    expect(checkBadWords('Dickinson campus').okay).toBe(true);
  });
});
