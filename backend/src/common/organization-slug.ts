import type { Prisma } from '@/prisma/prisma-client';

export function normalizeOrganizationSlug(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
    .replace(/-+$/g, '');
  return slug || 'organization';
}

export async function allocateOrganizationSlug(
  tx: Pick<Prisma.TransactionClient, 'organization'>,
  name: string,
) {
  const base = normalizeOrganizationSlug(name);
  for (let suffix = 1; suffix <= 1000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Unable to allocate a unique organization slug');
}
