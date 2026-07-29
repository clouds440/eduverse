import {
  escapeHtml,
  renderSecurityEmailLayout,
} from './security-email-layout.template';

function renderMessageBlock(message: string) {
  return escapeHtml(message)
    .split(/\r?\n/)
    .map((line) => line || '&nbsp;')
    .join('<br />');
}

export interface PublicContactSubmittedEmailInput {
  appBaseUrl: string;
  name: string;
  email: string;
  company?: string | null;
  subject: string;
  message: string;
  ticketId: string;
}

export function renderPublicContactSubmittedEmail(
  input: PublicContactSubmittedEmailInput,
) {
  const preview = `Your EduVerse support ticket ${input.ticketId.slice(0, 8)} has been submitted.`;
  const companyText = input.company ? `\nCompany: ${input.company}` : '';

  return {
    subject: 'We received your EduVerse support ticket',
    text: [
      `Hi ${input.name},`,
      preview,
      'Here is a copy of your request:',
      `Subject: ${input.subject}`,
      `Name: ${input.name}`,
      `Email: ${input.email}${companyText}`,
      input.message,
      'Our support team will review your request and contact you by email if a response is needed.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Support ticket submitted',
      title: 'We received your request',
      preview,
      bodyHtml: `
        <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">Hi ${escapeHtml(input.name)}, your support ticket has been submitted successfully. Our team will review it and contact you by email if a response is needed.</p>
        <div style="margin:0 0 18px;border:1px solid #dbeafe;border-radius:18px;background:#eff6ff;padding:16px;">
          <p style="margin:0 0 6px;color:#1d4ed8;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Ticket</p>
          <p style="margin:0;color:#111827;font-size:18px;font-weight:900;">${escapeHtml(input.ticketId.slice(0, 8))}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:18px;background:#ffffff;overflow:hidden;">
          <div style="padding:16px 18px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;color:#111827;font-size:16px;font-weight:900;line-height:1.35;">${escapeHtml(input.subject)}</p>
            <p style="margin:8px 0 0;color:#6b7280;font-size:13px;font-weight:700;line-height:1.5;">${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;${input.company ? ` · ${escapeHtml(input.company)}` : ''}</p>
          </div>
          <div style="padding:18px;color:#374151;font-size:14px;line-height:1.7;">
            ${renderMessageBlock(input.message)}
          </div>
        </div>
      `,
    }),
  };
}

export interface PublicContactReplyEmailInput {
  appBaseUrl: string;
  name: string;
  subject: string;
  content: string;
  ticketId: string;
}

export function renderPublicContactReplyEmail(input: PublicContactReplyEmailInput) {
  const preview = `EduVerse support replied to ticket ${input.ticketId.slice(0, 8)}.`;

  return {
    subject: `EduVerse support: ${input.subject}`,
    text: [
      `Hi ${input.name},`,
      `Our support team replied to your ticket ${input.ticketId.slice(0, 8)}:`,
      input.content,
      'This inbox is not monitored for replies. If you need more help, please submit a new contact request.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Support response',
      title: 'EduVerse support replied',
      preview,
      bodyHtml: `
        <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">Hi ${escapeHtml(input.name)}, our support team sent a response to your request.</p>
        <div style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:18px;background:#f8fafc;padding:16px;">
          <p style="margin:0 0 6px;color:#4f46e5;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">Ticket ${escapeHtml(input.ticketId.slice(0, 8))}</p>
          <p style="margin:0;color:#111827;font-size:16px;font-weight:900;line-height:1.35;">${escapeHtml(input.subject)}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-radius:18px;background:#ffffff;padding:18px;color:#374151;font-size:14px;line-height:1.7;">
          ${renderMessageBlock(input.content)}
        </div>
        <div style="margin-top:18px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;padding:14px;">
          <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.6;"><strong>Note:</strong> this mailbox is not monitored for replies. Submit another contact request if you need to continue the conversation.</p>
        </div>
      `,
    }),
  };
}
