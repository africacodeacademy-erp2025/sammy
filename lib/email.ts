import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Constants
const DEFAULT_EMAIL = "polokonkolanyane92@gmail.com";
const DEFAULT_BASE_URL = "http://localhost:3000";
const SMTP_CONFIG = {
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use TLS
} as const;

// Types
interface EmailConfig {
  service: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  from: {
    name: string;
    address: string;
  };
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Configuration factory
const createEmailConfig = (): EmailConfig => ({
  ...SMTP_CONFIG,
  auth: {
    user: process.env.SMTP_USER || DEFAULT_EMAIL,
    pass: process.env.SMTP_PASS || "",
  },
});

// Transporter factory
const createTransporter = (): Transporter | null => {
  if (!process.env.SMTP_PASS) {
    console.warn("SMTP_PASS not configured. Email sending will be disabled.");
    return null;
  }

  const config = createEmailConfig();
  return nodemailer.createTransport(config);
};

// URL helper
const buildResetUrl = (token: string, baseUrl?: string): string => {
  const finalBaseUrl = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_BASE_URL;
  return `${finalBaseUrl}/reset-password?token=${token}`;
};

// Email styling constants
const EMAIL_STYLES = {
  container: "max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #ffffff; border-radius: 12px; overflow: hidden;",
  header: "background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;",
  title: "margin: 0; font-size: 32px; font-weight: bold; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.3);",
  subtitle: "margin: 8px 0 0 0; font-size: 16px; color: #e2e8f0; opacity: 0.9;",
  content: "padding: 40px 30px;",
  button: "display: inline-block; padding: 16px 32px; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);",
} as const;

// Email content generators
const generateEmailHtml = (resetUrl: string, userEmail: string): string => `
  <div style="${EMAIL_STYLES.container}">
    <!-- Header -->
    <div style="${EMAIL_STYLES.header}">
      <h1 style="${EMAIL_STYLES.title}">🤖 SaMMy</h1>
      <p style="${EMAIL_STYLES.subtitle}">AI-Powered Social Media Assistant</p>
    </div>

    <!-- Content -->
    <div style="${EMAIL_STYLES.content}">
      <h2 style="color: #a78bfa; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">
        Password Reset Request
      </h2>
      
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        Hello! 👋
      </p>
      
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
        We received a request to reset the password for your SaMMy account associated with 
        <strong style="color: #a78bfa;">${userEmail}</strong>.
      </p>
      
      <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
        Click the button below to create a new password. This link will expire in <strong>24 hours</strong> for security reasons.
      </p>

      <!-- Reset Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="${EMAIL_STYLES.button}">Reset My Password 🔑</a>
      </div>

      <!-- Alternative Link -->
      <div style="background: #2a2d47; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px 0;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #a78bfa; font-size: 14px; word-break: break-all; margin: 0;">
          ${resetUrl}
        </p>
      </div>

      <!-- Security Notice -->
      <div style="border-left: 4px solid #f59e0b; background: #451a03; padding: 16px; margin: 20px 0;">
        <p style="color: #fbbf24; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
          🔒 Security Notice
        </p>
        <p style="color: #fde68a; font-size: 14px; line-height: 1.5; margin: 0;">
          If you didn't request this password reset, please ignore this email. Your account remains secure and no changes will be made.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #1e1e3f; padding: 20px 30px; text-align: center; border-top: 1px solid #374151;">
      <p style="color: #9ca3af; font-size: 14px; margin: 0 0 8px 0;">
        Best regards,<br>The SaMMy Team
      </p>
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
`;

const generateEmailText = (resetUrl: string, userEmail: string): string => `
Password Reset Request

Hello!

We received a request to reset the password for your SaMMy account associated with ${userEmail}.

Please click the following link to reset your password:
${resetUrl}

This link will expire in 24 hours for security reasons.

If you didn't request this password reset, please ignore this email. Your account remains secure and no changes will be made.

Best regards,
The SaMMy Team

This is an automated message. Please do not reply to this email.
`;

// Email options factory
const createPasswordResetEmail = (resetToken: string, userEmail: string, baseUrl?: string): EmailOptions => {
  const resetUrl = buildResetUrl(resetToken, baseUrl);
  const senderAddress = process.env.SMTP_USER || DEFAULT_EMAIL;

  return {
    from: {
      name: "SaMMy AI Assistant",
      address: senderAddress,
    },
    to: userEmail,
    subject: "Reset Your SaMMy Password",
    html: generateEmailHtml(resetUrl, userEmail),
    text: generateEmailText(resetUrl, userEmail),
  };
};

// Error handling helpers
const logEmailSuccess = (messageId: string, recipient: string): void => {
  console.log("Password reset email sent successfully:", {
    messageId,
    to: recipient,
    timestamp: new Date().toISOString(),
  });
};

const logEmailError = (error: unknown, recipient: string): void => {
  console.error("Failed to send password reset email:", {
    error: error instanceof Error ? error.message : "Unknown error",
    to: recipient,
    timestamp: new Date().toISOString(),
  });
};

// Main email sending function
export const sendPasswordResetEmail = async (
  resetToken: string, 
  userEmail: string,
  baseUrl?: string
): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.error("Email transporter not configured. Skipping email send.");
      return false;
    }

    const emailOptions = createPasswordResetEmail(resetToken, userEmail, baseUrl);
    const info = await transporter.sendMail(emailOptions);

    logEmailSuccess(info.messageId, userEmail);
    return true;
  } catch (error) {
    logEmailError(error, userEmail);
    return false;
  }
};

// Email configuration validation
export const testEmailConfiguration = async (): Promise<boolean> => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      return false;
    }

    await transporter.verify();
    console.log("Email configuration is valid");
    return true;
  } catch (error) {
    console.error("Email configuration test failed:", error);
    return false;
  }
};
