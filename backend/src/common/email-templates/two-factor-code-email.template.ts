import {
  escapeHtml,
  renderSecurityEmailLayout,
  renderVerificationCode,
} from './security-email-layout.template';

export interface TwoFactorCodeEmailInput {
  appBaseUrl: string;
  code: string;
  accountName: string;
  organizationLogoUrl?: string | null;
  expiresInMinutes: number;
}

export function renderTwoFactorCodeEmail(input: TwoFactorCodeEmailInput) {
  const guidance = `Enter this code on the sign-in screen. It expires in ${input.expiresInMinutes} minutes.`;
  return {
    subject: 'Your EduVerse sign-in code',
    text: [
      `Your EduVerse sign-in code is ${input.code}.`,
      guidance,
      'If you did not try to sign in, you can ignore this email.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Sign-in verification',
      title: 'Confirm it is you',
      preview: 'Use this code to finish signing in to EduVerse.',
      organizationName: input.accountName,
      organizationLogoUrl: input.organizationLogoUrl,
      includeIgnoreNotice: true,
      bodyHtml: `
        <p style="color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(guidance)}</p>
        <div style="text-align:center;margin:22px 0;">
          ${renderVerificationCode(input.code)}
        </div>
        <p style="color:#6b7280;font-size:13px;">If you did not try to sign in, you can ignore this email.</p>
      `,
    }),
  };
}
