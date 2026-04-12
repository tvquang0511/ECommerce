import { escapeHtml } from './escape.js';

type LayoutParams = {
  appName: string;
  title: string;
  preheader?: string;
  bodyHtml: string;
  footerText?: string;
};

export function renderLayout(params: LayoutParams): string {
  const preheader = (params.preheader ?? '').trim();
  const footerText = (params.footerText ?? `${params.appName} · This is an automated message.`).trim();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0; padding:0; background:#f6f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#111827;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>` : ''}

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f7fb; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%;">
          <tr>
            <td style="padding:12px 4px 16px 4px; font-size:14px; color:#374151;">
              <strong>${escapeHtml(params.appName)}</strong>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:20px;">
              <div style="font-size:18px; font-weight:700; margin-bottom:12px;">${escapeHtml(params.title)}</div>
              ${params.bodyHtml}
            </td>
          </tr>

          <tr>
            <td style="padding:14px 4px 0 4px; font-size:12px; color:#6b7280; line-height:1.5;">
              ${escapeHtml(footerText)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderButton(params: { url: string; label: string }): string {
  const url = escapeHtml(params.url);
  const label = escapeHtml(params.label);

  // Inline styles for better email client compatibility.
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr>
      <td bgcolor="#111827" style="border-radius:10px;">
        <a href="${url}" target="_blank" rel="noreferrer" style="display:inline-block; padding:12px 16px; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
  `.trim();
}
