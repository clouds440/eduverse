import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdmissionApplicationVersionStatus } from '@/prisma/prisma-client';
import { AdmissionFormsService } from './admission-forms.service';
import { validateAdmissionAnswers, validateAdmissionFormDefinition } from './admission-form-definition';

const definition = {
  sections: [{ key: 'applicant', title: 'Applicant', fields: [
    { key: 'fullName', type: 'SHORT_TEXT', label: 'Full name', required: true, canonicalTarget: 'applicant.name' },
    { key: 'email', type: 'EMAIL', label: 'Email', required: true, canonicalTarget: 'applicant.email' },
  ] }],
};

describe('Admission form definitions', () => {
  it('validates canonical mappings and extracts trusted applicant values', () => {
    const validated = validateAdmissionFormDefinition(definition);
    expect(validateAdmissionAnswers(validated, { fullName: 'Ada Lovelace', email: 'ADA@example.com', injected: 'ignored' })).toEqual({
      answers: { fullName: 'Ada Lovelace', email: 'ADA@example.com' },
      canonical: { 'applicant.name': 'Ada Lovelace', 'applicant.email': 'ADA@example.com' },
    });
  });

  it('rejects forms without applicant identity mappings', () => {
    expect(() => validateAdmissionFormDefinition({ sections: [{ key: 'other', title: 'Other', fields: [] }] }))
      .toThrow(BadRequestException);
  });
});

describe('AdmissionFormsService versioning', () => {
  const providers: any = { providerIdForOrganization: jest.fn().mockResolvedValue('provider-1') };

  it('keeps published versions immutable', async () => {
    const prisma: any = {
      admissionApplicationTemplateVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-1', status: AdmissionApplicationVersionStatus.PUBLISHED, documentRequirements: [], _count: {}, template: { providerId: 'provider-1' } }) },
    };
    const service = new AdmissionFormsService(prisma, providers);
    await expect(service.updateDraft('org-1', 'version-1', { definition, documentRequirements: [] }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('binds only a provider-owned published version and enables admissions from the admissions workspace', async () => {
    const tx: any = {
      programOfferingApplicationConfig: { upsert: jest.fn().mockResolvedValue({ id: 'config-1' }) },
      programOffering: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = {
      programOffering: { findFirst: jest.fn().mockResolvedValue({ id: 'offering-1', providerId: 'provider-1' }) },
      admissionApplicationTemplateVersion: { findFirst: jest.fn().mockResolvedValue({ id: 'version-1', status: AdmissionApplicationVersionStatus.PUBLISHED }) },
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
    };
    const service = new AdmissionFormsService(prisma, providers);
    await service.bindOffering('org-1', 'offering-1', { applicationVersionId: 'version-1', onlineAdmissionEnabled: true });
    expect(tx.programOfferingApplicationConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ providerId: 'provider-1', applicationVersionId: 'version-1' }),
    }));
    expect(tx.programOffering.update).toHaveBeenCalledWith({
      where: { id: 'offering-1' },
      data: { onlineAdmissionEnabled: true, onlineAdmissionInstructions: undefined },
    });
  });
});
