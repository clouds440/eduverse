export function isMissingSchemaObjectError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ((error as { code?: string }).code === 'P2021' || (error as { code?: string }).code === 'P2022'),
  );
}

