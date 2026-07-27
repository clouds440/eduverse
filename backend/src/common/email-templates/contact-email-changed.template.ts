function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[char];
  });
}

export interface ContactEmailChangedInput {
  organizationName: string;
  newContactEmail: string;
  contactUrl: string;
}

export function renderContactEmailChangedEmail(
  input: ContactEmailChangedInput,
) {
  return {
    subject: 'Your EduVerse contact email was changed',
    text: [
      `The verified contact email for ${input.organizationName} was changed to ${input.newContactEmail}.`,
      'Email two-factor authentication has been turned off until the new address is verified. Trusted-browser verification remains available if it was enabled.',
      'If you did not make this change, please contact EduVerse support immediately.',
    ].join('\n\n'),
    html: `
      <p>The verified contact email for <strong>${escapeHtml(input.organizationName)}</strong> was changed to <strong>${escapeHtml(input.newContactEmail)}</strong>.</p>
      <p>Email two-factor authentication has been turned off until the new address is verified. Trusted-browser verification remains available if it was enabled.</p>
      <p>If you did not make this change, please <a href="${escapeHtml(input.contactUrl)}" style="color:#4f46e5;font-weight:700;">contact</a> EduVerse support immediately.</p>
    `,
  };
}
