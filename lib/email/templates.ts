import { getAppUrl } from "../auth";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function baseTemplate(input: {
  title: string;
  intro: string;
  ctaLabel: string;
  actionUrl: string;
  details?: string;
}) {
  const safeTitle = escapeHtml(input.title);
  const safeIntro = escapeHtml(input.intro);
  const safeCta = escapeHtml(input.ctaLabel);
  const safeUrl = escapeHtml(input.actionUrl);
  const details = input.details ? `<p style="margin:16px 0 0;color:#52525b;font-size:14px;line-height:1.6">${escapeHtml(input.details)}</p>` : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">
      <tr>
        <td style="background:#08090d;padding:24px">
          <div style="font-size:20px;font-weight:700;color:#ffffff">VJM Drive</div>
          <div style="margin-top:4px;color:#d7ff3f;font-size:13px">Private visual asset drive by VJMRTIM</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 24px">
          <h1 style="margin:0;color:#18181b;font-size:24px;line-height:1.25">${safeTitle}</h1>
          <p style="margin:16px 0 0;color:#3f3f46;font-size:15px;line-height:1.65">${safeIntro}</p>
          ${details}
          <div style="margin:28px 0">
            <a href="${safeUrl}" style="display:inline-block;background:#08090d;color:#d7ff3f;text-decoration:none;border-radius:6px;padding:13px 18px;font-weight:700;font-size:14px">${safeCta}</a>
          </div>
          <p style="margin:0;color:#71717a;font-size:13px;line-height:1.6">If the button does not work, paste this link into your browser:</p>
          <p style="margin:8px 0 0;word-break:break-all;color:#3f3f46;font-size:13px;line-height:1.6">${safeUrl}</p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #e4e4e7;padding:18px 24px;color:#71717a;font-size:12px;line-height:1.6">
          This email was sent by VJM Drive.<br />
          If you did not request this, you can ignore this email.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${input.title}

${input.intro}
${input.details ? `\n${input.details}\n` : ""}
${input.ctaLabel}: ${input.actionUrl}

This email was sent by VJM Drive.
If you did not request this, you can ignore this email.`;

  return { html, text, actionUrl: input.actionUrl };
}

export function verifyEmailTemplate({ name, verifyUrl }: { name: string; verifyUrl: string }) {
  return {
    subject: "Verify your VJM Drive account",
    ...baseTemplate({
      title: "Verify your VJM Drive account",
      intro: `Hi ${name || "there"}, confirm your email address to finish creating your VJM Drive account.`,
      ctaLabel: "Verify email",
      actionUrl: verifyUrl,
    }),
  };
}

export function resetPasswordTemplate({ name, resetUrl }: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your VJM Drive password",
    ...baseTemplate({
      title: "Reset your password",
      intro: `Hi ${name || "there"}, use this secure link to set a new VJM Drive password. The link expires in 30 minutes.`,
      ctaLabel: "Reset password",
      actionUrl: resetUrl,
    }),
  };
}

export function shareAccessTemplate({
  name,
  sharedBy,
  shareTitle,
  shareUrl,
  permission,
  expiresAt,
}: {
  name?: string;
  sharedBy: string;
  shareTitle: string;
  shareUrl: string;
  permission: string;
  expiresAt?: string | null;
}) {
  return {
    subject: "You have been given access to a VJM Drive share",
    ...baseTemplate({
      title: "A VJM Drive share is ready",
      intro: `Hi ${name || "there"}, ${sharedBy} has given you access to "${shareTitle}".`,
      details: `Permission: ${permission}. Expires: ${expiresAt ? new Date(expiresAt).toLocaleString("id-ID") : "Never"}.`,
      ctaLabel: "Open share",
      actionUrl: shareUrl,
    }),
  };
}

export function quotaWarningTemplate({
  name,
  usedPercent,
  dashboardUrl = `${getAppUrl()}/dashboard`,
}: {
  name: string;
  usedPercent: number;
  dashboardUrl?: string;
}) {
  return {
    subject: "Your VJM Drive storage is almost full",
    ...baseTemplate({
      title: "Storage almost full",
      intro: `Hi ${name || "there"}, your VJM Drive storage is ${usedPercent}% full.`,
      ctaLabel: "Open dashboard",
      actionUrl: dashboardUrl,
    }),
  };
}
