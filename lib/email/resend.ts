import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  actionUrl?: string;
};

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "VJM Drive <no-reply@vjmrtim.my.id>";

  if (!apiKey) {
    console.warn("[email:dev] RESEND_API_KEY missing");
    console.log("[email:dev]", {
      to: input.to,
      from,
      subject: input.subject,
      actionUrl: input.actionUrl,
      text: input.text,
      html: input.html,
    });
    return { ok: true, dev: true };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      console.error("[email:resend] send failed", {
        to: input.to,
        subject: input.subject,
        error: result.error,
      });
      return { ok: false, error: result.error };
    }

    return { ok: true, id: result.data?.id };
  } catch (error) {
    console.error("[email:resend] unexpected error", {
      to: input.to,
      subject: input.subject,
      error,
    });
    return { ok: false, error };
  }
}
