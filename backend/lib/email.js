import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || "Trust Lending <noreply@example.com>";

const hasSmtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = hasSmtp
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

/**
 * Send an email. If SMTP is not configured, logs to console and resolves (dev mode).
 * If SMTP fails, falls back to console logging.
 * @param {string} to - Recipient email
 * @param {string} subject - Subject
 * @param {string} text - Plain text body
 * @returns {Promise<void>}
 */
export async function sendMail(to, subject, text) {
  if (transporter) {
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
      });
      return;
    } catch (error) {
      console.error("[EMAIL Error] Failed to send via SMTP:", error.message);
      console.log("[EMAIL Fallback] To:", to, "| Subject:", subject, "| Body:", text);
      return;
    }
  }
  console.log("[EMAIL Dev] To:", to, "| Subject:", subject, "| Body:", text);
}
