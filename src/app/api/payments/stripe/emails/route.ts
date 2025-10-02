import nodemailer from "nodemailer";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, planName, amount, currency, nextBilling } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Compose email
    const mailOptions = {
      from: `"Your App Name" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "✅ Payment Successful",
      html: `
        <h2>Thank you for your payment!</h2>
        <p>Your subscription is now active.</p>
        <ul>
          <li><strong>Plan:</strong> ${planName}</li>
          <li><strong>Amount:</strong> ${amount} ${currency}</li>
          <li><strong>Next Billing Date:</strong> ${nextBilling}</li>
        </ul>
        <p>We appreciate your support! 🎉</p>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Email sending error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
