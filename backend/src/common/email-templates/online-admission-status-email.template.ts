import { OnlineAdmissionSubmissionStatus } from '@/prisma/prisma-client';
import { escapeHtml, renderSecurityEmailLayout } from './security-email-layout.template';

export interface OnlineAdmissionStatusEmailInput {
  appBaseUrl: string;
  name: string;
  reference: string;
  organizationName: string;
  programLabel: string;
  status: OnlineAdmissionSubmissionStatus;
  note?: string | null;
  updateUrl?: string | null;
  templates?: OnlineAdmissionEmailTemplateOverrides | null;
}

export interface OnlineAdmissionEmailTemplateOverrides {
  submissionSubject?: string;
  submissionBody?: string;
  statusSubject?: string;
  statusBody?: string;
}

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => values[key] ?? match);
}

export function renderOnlineAdmissionStatusEmail(input: OnlineAdmissionStatusEmailInput) {
  const statusLabel = input.status.replaceAll('_', ' ').toLowerCase();
  const submitted = input.status === OnlineAdmissionSubmissionStatus.SUBMITTED;
  const defaultSubject = submitted
    ? `${input.organizationName} received your application`
    : `${input.organizationName} application update: ${statusLabel}`;
  const defaultSummary = submitted
    ? `Your application for ${input.programLabel} has been submitted.`
    : `Your application for ${input.programLabel} is now ${statusLabel}.`;
  const portalUrl = `${input.appBaseUrl.replace(/\/+$/, '')}/admissions`;
  const values = {
    applicantName: input.name,
    reference: input.reference,
    organizationName: input.organizationName,
    programName: input.programLabel,
    status: statusLabel,
    note: input.note || '',
    updateUrl: input.updateUrl || '',
    portalUrl,
  };
  const subjectTemplate = submitted ? input.templates?.submissionSubject : input.templates?.statusSubject;
  const bodyTemplate = submitted ? input.templates?.submissionBody : input.templates?.statusBody;
  const subject = subjectTemplate?.trim() ? applyTemplate(subjectTemplate.trim(), values) : defaultSubject;
  const summary = bodyTemplate?.trim() ? applyTemplate(bodyTemplate.trim(), values) : defaultSummary;

  return {
    subject,
    text: [
      `Hi ${input.name},`,
      summary,
      `Reference: ${input.reference}`,
      input.note ? `Note: ${input.note}` : '',
      input.updateUrl ? `Upload requested documents: ${input.updateUrl}` : '',
      `Admissions portal: ${portalUrl}`,
    ].filter(Boolean).join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: submitted ? 'Application received' : 'Application update',
      title: submitted ? 'Your application is in' : `Status: ${statusLabel}`,
      preview: summary,
      organizationName: input.organizationName,
      bodyHtml: `
        <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">Hi ${escapeHtml(input.name)}, ${escapeHtml(summary)}</p>
        <div style="margin:0 0 18px;border:1px solid #dbeafe;border-radius:14px;background:#eff6ff;padding:16px;">
          <p style="margin:0 0 6px;color:#1d4ed8;font-size:11px;font-weight:900;text-transform:uppercase;">Application reference</p>
          <p style="margin:0;color:#111827;font-size:18px;font-weight:900;">${escapeHtml(input.reference)}</p>
          <p style="margin:8px 0 0;color:#4b5563;font-size:14px;">${escapeHtml(input.programLabel)}</p>
        </div>
        ${input.note ? `<div style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:14px;padding:16px;color:#374151;font-size:14px;line-height:1.65;"><strong>Admissions note</strong><br />${escapeHtml(input.note).replace(/\r?\n/g, '<br />')}</div>` : ''}
        ${input.updateUrl ? `<p style="margin:0 0 18px;"><a href="${escapeHtml(input.updateUrl)}" style="display:inline-block;border-radius:10px;background:#4f46e5;padding:12px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">Upload requested documents</a></p>` : ''}
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">You can browse current admissions at <a href="${escapeHtml(portalUrl)}" style="color:#4f46e5;">the admissions portal</a>. Keep your reference for future correspondence.</p>
      `,
    }),
  };
}
