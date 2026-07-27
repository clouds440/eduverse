import {
  escapeHtml,
  renderSecurityEmailLayout,
} from './security-email-layout.template';

export interface PendingOrganizationVerifiedEmailInput {
  appBaseUrl: string;
  actionUrl: string;
  organizationId: string;
  organizationName: string;
  contactEmail: string;
}

export function renderPendingOrganizationVerifiedEmail(
  input: PendingOrganizationVerifiedEmailInput,
) {
  const title = 'Organization ready for review';
  const intro = `${input.organizationName} verified its contact email and is pending platform approval.`;
  return {
    subject: `Pending organization verified: ${input.organizationName}`,
    text: [
      intro,
      `Organization ID: ${input.organizationId}`,
      `Contact email: ${input.contactEmail}`,
      `Review organizations: ${input.actionUrl}`,
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Platform review',
      title,
      preview: intro,
      bodyHtml: `
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
          <div style="border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;padding:14px;margin-bottom:18px;">
            <p style="margin:0;color:#6b7280;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Organization</p>
            <p style="margin:6px 0 0;color:#111827;font-size:16px;font-weight:900;">${escapeHtml(input.organizationName)}</p>
            <p style="margin:6px 0 0;color:#4b5563;font-size:13px;font-weight:700;">${escapeHtml(input.contactEmail)}</p>
            <p style="margin:6px 0 0;color:#6b7280;font-size:12px;font-family:Consolas,Menlo,monospace;">${escapeHtml(input.organizationId)}</p>
          </div>
          <a href="${escapeHtml(input.actionUrl)}" style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 16px;font-size:14px;font-weight:800;">Review organizations</a>
        `,
    }),
  };
}
