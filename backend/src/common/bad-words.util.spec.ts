import { checkBadWords } from './bad-words.util';

describe('bad words util', () => {
  it('allows normal school text', () => {
    expect(checkBadWords('Class assignment feedback looks good.').okay).toBe(true);
  });

  it('blocks direct inappropriate words', () => {
    expect(checkBadWords('This is shit')).toEqual({
      okay: false,
      matches: ['shit'],
    });
  });

  it('blocks separated inappropriate words', () => {
    expect(checkBadWords('f u c k')).toEqual({
      okay: false,
      matches: ['f u c k', 'fuck'],
    });
  });

  it('does not block clean words that merely share a prefix', () => {
    expect(checkBadWords('Dickinson campus').okay).toBe(true);
  });
});
