export function configuredOrigins(value = process.env.FRONTEND_URL): string[] {
  if (!value) return [];

  const origins = value
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const url = new URL(candidate);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Unsupported frontend URL protocol: ${url.protocol}`);
      }
      return url.origin;
    });

  return [...new Set(origins)];
}

export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins = configuredOrigins(),
): boolean {
  if (!origin) return true;

  try {
    return allowedOrigins.includes(new URL(origin).origin);
  } catch {
    return false;
  }
}
