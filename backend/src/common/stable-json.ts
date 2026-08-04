function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortJson(entry)]),
  );
}

export function stableJsonStringify(value: unknown) {
  const jsonValue = JSON.parse(JSON.stringify(value)) as unknown;
  return JSON.stringify(sortJson(jsonValue));
}
