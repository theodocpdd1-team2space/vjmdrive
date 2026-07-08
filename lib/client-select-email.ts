import { findUserById, getAppUrl, normalizeEmail } from "./auth";
import type { ClientSelectLink, ClientSelectSubmission } from "./client-select-db";
import { sendEmail } from "./email/resend";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function ownerEmailForLink(link: ClientSelectLink) {
  if (link.ownerUserId === "admin") {
    const adminEmail = process.env.ADMIN_EMAIL || "";
    return adminEmail ? normalizeEmail(adminEmail) : "";
  }

  const owner = await findUserById(link.ownerUserId);
  return owner?.email ? normalizeEmail(owner.email) : "";
}

export async function sendClientSelectSubmittedEmail({
  link,
  submission,
}: {
  link: ClientSelectLink;
  submission: ClientSelectSubmission;
}) {
  const ownerEmail = await ownerEmailForLink(link);
  if (!ownerEmail) {
    return { ok: false as const, skipped: true, error: "Owner email not found." };
  }

  const appUrl = getAppUrl();
  const ownerUrl = `${appUrl}${link.ownerUserId === "admin" ? "/admin/client-select" : "/client-select"}`;
  const publicUrl = `${appUrl}/select/${link.token}`;
  const subject = `Client selection submitted: ${link.projectName}`;
  const details = [
    `Project name: ${link.projectName}`,
    `Client name: ${submission.clientName}`,
    `Client email: ${submission.clientEmail}`,
    `Selected count: ${submission.selectedFiles.length}`,
    `Global note: ${submission.globalNote || "-"}`,
    `Owner detail: ${ownerUrl}`,
    `Public selection: ${publicUrl}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden">
      <tr><td style="background:#08090d;padding:24px"><div style="font-size:20px;font-weight:700;color:#ffffff">VJM Drive</div><div style="margin-top:4px;color:#d7ff3f;font-size:13px">Client Select</div></td></tr>
      <tr>
        <td style="padding:28px 24px">
          <h1 style="margin:0;color:#18181b;font-size:24px;line-height:1.25">${escapeHtml(subject)}</h1>
          <p style="margin:16px 0 0;color:#3f3f46;font-size:15px;line-height:1.65">A client has submitted a photo selection.</p>
          <pre style="margin:16px 0 0;white-space:pre-wrap;color:#3f3f46;font-size:14px;line-height:1.6">${escapeHtml(details)}</pre>
          <div style="margin:28px 0"><a href="${escapeHtml(ownerUrl)}" style="display:inline-block;background:#08090d;color:#d7ff3f;text-decoration:none;border-radius:6px;padding:13px 18px;font-weight:700;font-size:14px">Open Client Select</a></div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const result = await sendEmail({
    to: ownerEmail,
    subject,
    html,
    text: `${subject}\n\n${details}`,
    actionUrl: ownerUrl,
  });

  if (result.ok && "dev" in result && result.dev) {
    return { ok: false as const, skipped: true, error: "Email config missing; notification skipped." };
  }

  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error instanceof Error ? result.error.message : JSON.stringify(result.error),
    };
  }

  return { ok: true as const };
}
