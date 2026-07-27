import {
  escapeHtml,
  renderSecurityEmailLayout,
} from './security-email-layout.template';

export interface LoginSecurityAlertEmailInput {
  appBaseUrl: string;
  title: string;
  summary: string;
  deviceName?: string | null;
  location?: string | null;
  ip?: string | null;
  securityUrl: string;
}

export function renderLoginSecurityAlertEmail(
  input: LoginSecurityAlertEmailInput,
) {
  const details = [
    input.deviceName && `Device: ${input.deviceName}`,
    input.location && `Location: ${input.location}`,
    input.ip && `IP address: ${input.ip}`,
  ].filter(Boolean) as string[];

  return {
    subject: input.title,
    text: [
      input.summary,
      ...details,
      `Review your sessions: ${input.securityUrl}`,
      'If this was you, no action is needed.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Account security',
      title: input.title,
      preview: input.summary,
      bodyHtml: `
        <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(input.summary)}</p>
        ${details.length ? `<div style="margin-bottom:18px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;">${details.map((detail) => `<p style="margin:4px 0;color:#374151;font-size:13px;line-height:1.5;">${escapeHtml(detail)}</p>`).join('')}</div>` : ''}
        <a href="${escapeHtml(input.securityUrl)}" style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 16px;font-size:14px;font-weight:800;">Review devices and sessions</a>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">If this was you, no action is needed.</p>
      `,
    }),
  };
}
