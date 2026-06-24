import Filter from 'bad-words';

const LEET_REPLACEMENTS: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '!': 'i',
  '1': 'i',
  '|': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
};

const profanityFilter = new Filter();

export type BadWordsCheckResult = {
  okay: boolean;
  matches: string[];
};

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[@431!|0$57]/g, (char) => LEET_REPLACEMENTS[char] ?? char)
    .replace(/[^a-z]+/g, '');
}

export function checkBadWords(value: string): BadWordsCheckResult {
  const normalizedTokens = (value.match(/[a-zA-Z0-9@!|$]+/g) ?? [])
    .map(normalizeToken)
    .filter(Boolean);
  const candidates = [value, normalizedTokens.join(' ')];

  if (normalizedTokens.length > 1 && normalizedTokens.some((token) => token.length <= 2)) {
    candidates.push(normalizedTokens.join(''));
  }

  const okay = !candidates.some((candidate) => profanityFilter.isProfane(candidate));

  return {
    okay,
    matches: okay ? [] : ['profanity'],
  };
}

export function hasBadWords(value: string) {
  return !checkBadWords(value).okay;
}
