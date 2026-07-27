import {
  escapeHtml,
  renderSecurityEmailLayout,
  renderVerificationCode,
} from './security-email-layout.template';

export interface ContactVerificationEmailInput {
  appBaseUrl: string;
  code: string;
  organizationName: string;
  contactEmail: string;
  organizationLogoUrl?: string | null;
  reason: string | null;
}

export function renderContactVerificationEmail(
  input: ContactVerificationEmailInput,
) {
  const isFirstRegistration = input.reason === 'first_registration';
  const intro =
    input.reason === 'contact_email_changed'
      ? `A new contact email was set for ${input.organizationName}.`
      : isFirstRegistration
        ? `Welcome to EduVerse, ${input.organizationName}.`
        : `Please verify the contact email for ${input.organizationName}.`;
  const guidance = isFirstRegistration
    ? 'Before approval can continue, verify this contact email. It will be used for password recovery, important organization notifications, and security communication.'
    : 'This code verifies the contact email for this organization workspace only.';
  return {
    subject: isFirstRegistration
      ? `Welcome to EduVerse, ${input.organizationName}`
      : `Verify ${input.organizationName}'s EduVerse contact email`,
    text: [
      intro,
      guidance,
      `Contact email: ${input.contactEmail}`,
      `Verification code: ${input.code}`,
      'This code expires in 10 minutes.',
      'If this mailbox is used for multiple EduVerse organizations, use this code only in the workspace named above.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: isFirstRegistration
        ? 'Welcome to EduVerse'
        : 'Contact email verification',
      title: isFirstRegistration
        ? 'Verify your organization contact'
        : 'Confirm this contact email',
      preview: `${intro} ${guidance}`,
      organizationName: input.organizationName,
      organizationLogoUrl: input.organizationLogoUrl,
      bodyHtml: `
          <p style="margin:0 0 10px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(guidance)}</p>
          <div style="border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;padding:14px;margin-bottom:18px;">
            <p style="margin:0;color:#6b7280;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Contact email</p>
            <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:800;">${escapeHtml(input.contactEmail)}</p>
          </div>
          <div style="text-align:center;margin:22px 0;">
            <p style="margin:0 0 10px;color:#6b7280;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Verification code</p>
            ${renderVerificationCode(input.code)}
          </div>
          <div style="border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;padding:14px;">
            <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.6;"><strong>Shared mailbox?</strong> This code verifies only ${escapeHtml(input.organizationName)}. It does not verify any other EduVerse organization that may use the same contact email.</p>
          </div>
        `,
    }),
  };
}
