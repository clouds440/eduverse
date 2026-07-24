export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getSafeAssetUrl(
  value: string | null | undefined,
  appBaseUrl: string,
) {
  if (!value) return null;
  try {
    const url = value.startsWith('/')
      ? new URL(value, appBaseUrl)
      : new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function renderVerificationCode(code: string) {
  return `
      <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;border-collapse:separate;border-spacing:8px 0;user-select:text;-webkit-user-select:text;">
        <tr>
          ${code
            .split('')
            .map(
              (digit) =>
                `<td style="height:48px;width:40px;border-radius:12px;background:#111827;color:#ffffff;font-family:Consolas,Menlo,monospace;font-size:24px;font-weight:900;line-height:48px;text-align:center;vertical-align:middle;user-select:text;-webkit-user-select:text;">${escapeHtml(digit)}</td>`,
            )
            .join('')}
        </tr>
      </table>
      <p style="margin:10px 0 0;color:#111827;font-family:Consolas,Menlo,monospace;font-size:14px;font-weight:800;letter-spacing:.16em;user-select:text;-webkit-user-select:text;">${escapeHtml(code)}</p>
    `;
}

export function renderSecurityEmailLayout(input: {
  appBaseUrl: string;
  eyebrow: string;
  title: string;
  preview: string;
  bodyHtml: string;
  organizationName?: string;
  organizationLogoUrl?: string | null;
}) {
  const platformLogoUrl = `${input.appBaseUrl}/assets/eduverse-icon-192.png`;
  const orgLogoHtml = input.organizationLogoUrl
    ? `<img src="${escapeHtml(input.organizationLogoUrl)}" width="34" height="34" alt="" style="height:34px;width:34px;border-radius:999px;object-fit:cover;border:1px solid #e5e7eb;background:#ffffff;" />`
    : '';
  const orgNameHtml = input.organizationName
    ? `<span style="color:#6b7280;font-size:13px;font-weight:700;">${escapeHtml(input.organizationName)}</span>`
    : '';

  return `
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${escapeHtml(input.title)}</title>
        </head>
        <body style="margin:0;background:#eef2f7;padding:28px 14px;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preview)}</div>
          <div style="max-width:640px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:18px;">
              <img src="${escapeHtml(platformLogoUrl)}" width="56" height="56" alt="EduVerse" style="height:56px;width:56px;border-radius:16px;box-shadow:0 10px 28px rgba(79,70,229,.25);" />
            </div>
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.12);">
              <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#eef2ff 0%,#ffffff 58%,#ecfeff 100%);border-bottom:1px solid #e5e7eb;">
                <p style="margin:0 0 10px;color:#4f46e5;font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;">${escapeHtml(input.eyebrow)}</p>
                <h1 style="margin:0;color:#111827;font-size:25px;line-height:1.2;font-weight:900;">${escapeHtml(input.title)}</h1>
                ${
                  input.organizationName
                    ? `<div style="margin-top:16px;display:flex;align-items:center;gap:10px;">${orgLogoHtml}${orgNameHtml}</div>`
                    : ''
                }
              </div>
              <div style="padding:26px 28px 28px;">
                ${input.bodyHtml}
              </div>
            </div>
            <p style="margin:18px 0 0;text-align:center;color:#6b7280;font-size:12px;line-height:1.6;">EduVerse security email. You can safely ignore this message if you did not request it.</p>
          </div>
        </body>
      </html>
    `;
}
