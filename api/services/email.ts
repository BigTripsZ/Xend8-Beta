import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  secure: boolean;
}

export async function sendEmail(
  config: SMTPConfig,
  to: string,
  subject: string,
  html: string,
  senderName?: string,
  senderEmail?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
    } as SMTPTransport.Options);

    const fromAddress = senderEmail || config.username;

    const info = await transporter.sendMail({
      from: `"${senderName || "✗ᴇɴᴅ8"}" <${fromAddress}>`,
      to,
      subject,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function testSMTPConnection(config: SMTPConfig): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: config.password,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    } as SMTPTransport.Options);

    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
