import { BadRequestException } from '@nestjs/common';

export const ADMISSION_FIELD_TYPES = [
  'SHORT_TEXT', 'LONG_TEXT', 'EMAIL', 'PHONE', 'DATE', 'NUMBER', 'SELECT',
  'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'ADDRESS', 'CONSENT', 'DOCUMENT_UPLOAD',
] as const;

export const ADMISSION_CANONICAL_TARGETS = [
  'applicant.name', 'applicant.email', 'applicant.phone',
  'student.fatherName', 'student.gender', 'student.dateOfBirth', 'student.address',
  'student.emergencyContact', 'student.bloodGroup', 'student.previousSchool', 'student.notes',
  'guardian.name', 'guardian.email', 'guardian.phone', 'guardian.relationship',
] as const;

export type AdmissionFieldType = typeof ADMISSION_FIELD_TYPES[number];
export type AdmissionCanonicalTarget = typeof ADMISSION_CANONICAL_TARGETS[number];

export type AdmissionFormOption = { value: string; label: string };
export type AdmissionFormField = {
  key: string;
  type: AdmissionFieldType;
  label: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  options?: AdmissionFormOption[];
  canonicalTarget?: AdmissionCanonicalTarget;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number };
  visibility?: { fieldKey: string; operator: 'EQUALS' | 'NOT_EQUALS'; value: string | number | boolean };
};
export type AdmissionFormSection = { key: string; title: string; description?: string; fields: AdmissionFormField[] };
export type AdmissionFormDefinition = { sections: AdmissionFormSection[] };

const keyPattern = /^[a-z][a-zA-Z0-9_]{1,63}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateAdmissionFormDefinition(value: unknown): AdmissionFormDefinition {
  if (!object(value) || !Array.isArray(value.sections) || value.sections.length === 0 || value.sections.length > 20) {
    throw new BadRequestException('Application form must contain between 1 and 20 sections');
  }
  const sectionKeys = new Set<string>();
  const fieldKeys = new Set<string>();
  const canonicalTargets = new Set<string>();
  const sections = value.sections.map((rawSection) => {
    if (!object(rawSection) || typeof rawSection.key !== 'string' || !keyPattern.test(rawSection.key)
      || typeof rawSection.title !== 'string' || !rawSection.title.trim() || !Array.isArray(rawSection.fields)) {
      throw new BadRequestException('Every form section needs a valid key, title, and fields array');
    }
    if (sectionKeys.has(rawSection.key)) throw new BadRequestException(`Duplicate section key: ${rawSection.key}`);
    sectionKeys.add(rawSection.key);
    if (rawSection.fields.length > 50) throw new BadRequestException('A form section cannot contain more than 50 fields');
    const fields = rawSection.fields.map((rawField) => {
      if (!object(rawField) || typeof rawField.key !== 'string' || !keyPattern.test(rawField.key)
        || typeof rawField.label !== 'string' || !rawField.label.trim()
        || typeof rawField.type !== 'string' || !ADMISSION_FIELD_TYPES.includes(rawField.type as AdmissionFieldType)) {
        throw new BadRequestException('Every form field needs a valid key, label, and supported type');
      }
      if (fieldKeys.has(rawField.key)) throw new BadRequestException(`Duplicate field key: ${rawField.key}`);
      fieldKeys.add(rawField.key);
      if (rawField.canonicalTarget !== undefined) {
        if (typeof rawField.canonicalTarget !== 'string' || !ADMISSION_CANONICAL_TARGETS.includes(rawField.canonicalTarget as AdmissionCanonicalTarget)) {
          throw new BadRequestException(`Unsupported canonical target for ${rawField.key}`);
        }
        if (canonicalTargets.has(rawField.canonicalTarget)) throw new BadRequestException(`Canonical target is mapped more than once: ${rawField.canonicalTarget}`);
        canonicalTargets.add(rawField.canonicalTarget);
      }
      const options = rawField.options;
      if (['SELECT', 'MULTI_SELECT', 'RADIO'].includes(rawField.type)) {
        if (!Array.isArray(options) || options.length < 1 || options.length > 100) throw new BadRequestException(`${rawField.label} needs options`);
        const values = new Set<string>();
        for (const option of options) {
          if (!object(option) || typeof option.value !== 'string' || !option.value || typeof option.label !== 'string' || !option.label.trim()) {
            throw new BadRequestException(`Invalid option in ${rawField.label}`);
          }
          if (values.has(option.value)) throw new BadRequestException(`Duplicate option in ${rawField.label}`);
          values.add(option.value);
        }
      } else if (options !== undefined) {
        throw new BadRequestException(`${rawField.label} cannot define options`);
      }
      if (rawField.validation !== undefined && !object(rawField.validation)) throw new BadRequestException(`Invalid validation for ${rawField.label}`);
      if (rawField.visibility !== undefined) {
        if (!object(rawField.visibility) || typeof rawField.visibility.fieldKey !== 'string'
          || !['EQUALS', 'NOT_EQUALS'].includes(String(rawField.visibility.operator))) {
          throw new BadRequestException(`Invalid visibility rule for ${rawField.label}`);
        }
      }
      return rawField as AdmissionFormField;
    });
    return { ...rawSection, title: rawSection.title.trim(), fields } as AdmissionFormSection;
  });
  for (const section of sections) for (const field of section.fields) {
    if (field.visibility && (!fieldKeys.has(field.visibility.fieldKey) || field.visibility.fieldKey === field.key)) {
      throw new BadRequestException(`Visibility rule for ${field.label} references an invalid field`);
    }
  }
  if (!canonicalTargets.has('applicant.name') || !canonicalTargets.has('applicant.email')) {
    throw new BadRequestException('Application forms must map applicant name and applicant email');
  }
  return { sections };
}

function visible(field: AdmissionFormField, answers: Record<string, unknown>) {
  if (!field.visibility) return true;
  const equal = answers[field.visibility.fieldKey] === field.visibility.value;
  return field.visibility.operator === 'EQUALS' ? equal : !equal;
}

export function validateAdmissionAnswers(definition: AdmissionFormDefinition, input: unknown) {
  if (!object(input)) throw new BadRequestException('Application answers must be an object');
  const answers: Record<string, unknown> = {};
  const canonical: Partial<Record<AdmissionCanonicalTarget, unknown>> = {};
  for (const section of definition.sections) for (const field of section.fields) {
    if (!visible(field, input)) continue;
    const value = input[field.key];
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === false;
    if (field.required && empty) throw new BadRequestException(`${field.label} is required`);
    if (empty) continue;
    if (field.type === 'CHECKBOX' || field.type === 'CONSENT') {
      if (typeof value !== 'boolean') throw new BadRequestException(`${field.label} must be checked or unchecked`);
    } else if (field.type === 'NUMBER') {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequestException(`${field.label} must be a number`);
      if (field.validation?.min !== undefined && value < field.validation.min) throw new BadRequestException(`${field.label} is below the minimum`);
      if (field.validation?.max !== undefined && value > field.validation.max) throw new BadRequestException(`${field.label} is above the maximum`);
    } else if (field.type === 'MULTI_SELECT') {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !field.options?.some((option) => option.value === item))) {
        throw new BadRequestException(`${field.label} contains an invalid selection`);
      }
    } else if (field.type === 'ADDRESS') {
      if (!object(value)) throw new BadRequestException(`${field.label} must be a structured address`);
    } else {
      if (typeof value !== 'string') throw new BadRequestException(`${field.label} must be text`);
      if (field.type === 'EMAIL' && !emailPattern.test(value)) throw new BadRequestException(`${field.label} must be a valid email`);
      if (field.type === 'DATE' && Number.isNaN(Date.parse(value))) throw new BadRequestException(`${field.label} must be a valid date`);
      if (field.options && !field.options.some((option) => option.value === value)) throw new BadRequestException(`${field.label} contains an invalid selection`);
      if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) throw new BadRequestException(`${field.label} is too short`);
      if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) throw new BadRequestException(`${field.label} is too long`);
    }
    answers[field.key] = value;
    if (field.canonicalTarget) canonical[field.canonicalTarget] = value;
  }
  return { answers, canonical };
}

export const DEFAULT_CAMPUS_ADMISSION_DEFINITION: AdmissionFormDefinition = {
  sections: [
    { key: 'identity', title: 'Applicant identity', fields: [
      { key: 'fullName', type: 'SHORT_TEXT', label: 'Full name', required: true, canonicalTarget: 'applicant.name', validation: { maxLength: 160 } },
      { key: 'email', type: 'EMAIL', label: 'Email', required: true, canonicalTarget: 'applicant.email', validation: { maxLength: 320 } },
      { key: 'phone', type: 'PHONE', label: 'Phone', canonicalTarget: 'applicant.phone', validation: { maxLength: 60 } },
    ] },
    { key: 'personal', title: 'Personal details', fields: [
      { key: 'fatherName', type: 'SHORT_TEXT', label: 'Father name', canonicalTarget: 'student.fatherName' },
      { key: 'gender', type: 'SELECT', label: 'Gender', required: true, canonicalTarget: 'student.gender', options: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }] },
      { key: 'dateOfBirth', type: 'DATE', label: 'Date of birth', canonicalTarget: 'student.dateOfBirth' },
      { key: 'bloodGroup', type: 'SHORT_TEXT', label: 'Blood group', canonicalTarget: 'student.bloodGroup' },
    ] },
    { key: 'contact', title: 'Contact details', fields: [
      { key: 'address', type: 'LONG_TEXT', label: 'Address', canonicalTarget: 'student.address' },
      { key: 'emergencyContact', type: 'PHONE', label: 'Emergency contact', canonicalTarget: 'student.emergencyContact' },
    ] },
    { key: 'background', title: 'Education background', fields: [
      { key: 'previousSchool', type: 'SHORT_TEXT', label: 'Previous school', canonicalTarget: 'student.previousSchool' },
      { key: 'notes', type: 'LONG_TEXT', label: 'Additional notes', canonicalTarget: 'student.notes', validation: { maxLength: 2000 } },
    ] },
  ],
};
