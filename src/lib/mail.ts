import nodemailer from "nodemailer";

type MailInput = {
  to: string;
  subject: string;
  text: string;
};

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export async function sendMail({ to, subject, text }: MailInput) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured.");
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });
}

export async function sendTemporaryPasswordEmail({
  email,
  name,
  temporaryPassword,
}: {
  email: string;
  name?: string | null;
  temporaryPassword: string;
}) {
  const appUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const displayName = name?.trim() || email;

  await sendMail({
    to: email,
    subject: "Your Portfolio Tracker temporary password",
    text: [
      `Hi ${displayName},`,
      "",
      "Your temporary Portfolio Tracker password is:",
      temporaryPassword,
      "",
      "Open the login page, enter your email, then use this temporary password to set a new password.",
      appUrl,
      "",
      "This temporary password expires in 24 hours.",
    ].join("\n"),
  });
}
