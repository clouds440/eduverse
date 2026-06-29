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

type Candidate = {
  text: string;
  normalized?: boolean;
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
  const candidates: Candidate[] = [
    { text: value },
    { text: normalizedTokens.join(' '), normalized: true },
  ];

  if (normalizedTokens.length > 1 && normalizedTokens.some((token) => token.length <= 2)) {
    candidates.push({ text: normalizedTokens.join(''), normalized: true });
  }

  const matches = Array.from(new Set(candidates.flatMap(findProfanityMatches)));

  return {
    okay: matches.length === 0,
    matches,
  };
}

export function hasBadWords(value: string) {
  return !checkBadWords(value).okay;
}

function findProfanityMatches(candidate: Candidate) {
  if (!candidate.text) return [];
  return profanityFilter.list
    .filter((word: string) => {
      const wordExp = new RegExp(`\\b${word.replace(/(\W)/g, '\\$1')}\\b`, 'gi');
      return !profanityFilter.exclude.includes(word.toLowerCase()) && wordExp.test(candidate.text);
    })
    .map((word: string) => candidate.normalized ? word.toLowerCase() : word);
}
