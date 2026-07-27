import {
  escapeHtml,
  renderSecurityEmailLayout,
} from './security-email-layout.template';

export interface PasswordResetEmailInput {
  recipient: string;
  appBaseUrl: string;
  options: Array<{
    adminEmail: string;
    organizationName: string;
    organizationLogoUrl?: string | null;
    resetUrl: string;
  }>;
  expiresAt: Date;
}

export function renderPasswordResetEmail(input: PasswordResetEmailInput) {
  const isMultiple = input.options.length > 1;
  const title = isMultiple
    ? 'Choose an account to recover'
    : 'Reset your EduVerse password';
  const intro = isMultiple
    ? `We found ${input.options.length} organization admin accounts that use this recovery email. Choose the one you want to reset.`
    : `A password reset was requested for ${input.options[0].organizationName}.`;
  const optionText = input.options
    .map((option, index) =>
      [
        `${index + 1}. ${option.organizationName}`,
        `Admin login: ${option.adminEmail}`,
        `Reset link: ${option.resetUrl}`,
      ].join('\n'),
    )
    .join('\n\n');
  const optionCards = input.options
    .map((option, index) => {
      const escapedOrgName = escapeHtml(option.organizationName);
      const escapedAdminEmail = escapeHtml(option.adminEmail);
      const escapedResetUrl = escapeHtml(option.resetUrl);
      const logoHtml = option.organizationLogoUrl
        ? `<img src="${escapeHtml(option.organizationLogoUrl)}" width="42" height="42" alt="" style="height:42px;width:42px;border-radius:999px;object-fit:cover;border:1px solid #e5e7eb;background:#ffffff;" />`
        : `<div style="height:42px;width:42px;border-radius:999px;background:#eef2ff;color:#4f46e5;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;">${escapeHtml(option.organizationName.charAt(0).toUpperCase() || 'E')}</div>`;
      return `
          <div style="border:1px solid #e5e7eb;border-radius:16px;background:#ffffff;padding:18px;margin-top:${index === 0 ? '0' : '14px'};">
            <div style="display:flex;gap:12px;align-items:center;">
              ${logoHtml}
              <div style="min-width:0;">
                <p style="margin:0;color:#111827;font-size:16px;font-weight:800;line-height:1.35;">${escapedOrgName}</p>
                <p style="margin:4px 0 0;color:#6b7280;font-size:13px;font-weight:600;line-height:1.4;">Admin login: ${escapedAdminEmail}</p>
              </div>
            </div>
            <a href="${escapedResetUrl}" style="display:block;margin-top:16px;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:800;">Reset this account</a>
          </div>
        `;
    })
    .join('');
  return {
    subject: isMultiple
      ? 'Choose an EduVerse account to recover'
      : 'Reset your EduVerse password',
    text: [
      title,
      intro,
      optionText,
      'Each link expires in 30 minutes.',
      'If you did not request this, ignore this email. Your password will not change.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Password recovery',
      title,
      preview: intro,
      bodyHtml: `
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
          ${optionCards}
          <div style="margin-top:18px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;">
            <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;"><strong>Security note:</strong> each reset link expires in 30 minutes. If this mailbox handles multiple organizations, only use the card for the account you intended to recover.</p>
          </div>
        `,
    }),
  };
}

export interface ManagedPasswordResetEmailInput {
  appBaseUrl: string;
  resetUrl: string;
  expiresAt: Date;
  userName: string;
  organizationName: string;
  organizationLogoUrl?: string | null;
}

export function renderManagedPasswordResetEmail(
  input: ManagedPasswordResetEmailInput,
) {
  const intro = `An administrator from ${input.organizationName} generated a password reset link for ${input.userName}.`;
  return {
    subject: 'Your EduVerse password reset link',
    text: [
      intro,
      `Reset link: ${input.resetUrl}`,
      'This link expires in 30 minutes.',
      'If you did not request help with your EduVerse password, contact your organization administrator.',
    ].join('\n\n'),
    html: renderSecurityEmailLayout({
      appBaseUrl: input.appBaseUrl,
      eyebrow: 'Password reset',
      title: 'Reset your EduVerse password',
      preview: intro,
      organizationName: input.organizationName,
      organizationLogoUrl: input.organizationLogoUrl,
      bodyHtml: `
          <p style="margin:0 0 18px;color:#4b5563;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
          <a href="${escapeHtml(input.resetUrl)}" style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;padding:13px 16px;font-size:14px;font-weight:800;">Reset password</a>
          <div style="margin-top:18px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb;padding:14px;">
            <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;"><strong>Security note:</strong> this link expires in 30 minutes and can only be used once.</p>
          </div>
        `,
    }),
  };
}
