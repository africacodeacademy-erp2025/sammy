import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { generateResetToken } from "../../../../../lib/crypto";
import { sendPasswordResetEmail } from "../../../../../lib/email";

// Constants
const RESET_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_MS = RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const RESPONSES = {
  EMAIL_REQUIRED: "Email is required",
  RESET_LINK_SENT: "If an account exists with this email, a reset link has been sent.",
  INTERNAL_ERROR: "Internal server error",
} as const;

// Types
interface ForgotPasswordRequest {
  email?: string;
}

// Helper functions
const createErrorResponse = (message: string, status: number) => {
  return NextResponse.json({ success: false, error: message }, { status });
};

const createSuccessResponse = (message: string) => {
  return NextResponse.json({ success: true, message });
};

const validateRequest = (body: ForgotPasswordRequest): string | null => {
  if (!body.email) {
    return RESPONSES.EMAIL_REQUIRED;
  }
  return null;
};

const getBaseUrl = (req: NextRequest): string => {
  // Try environment variable first (for production)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // Fall back to request headers
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  
  return `${protocol}://${host}`;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const validationError = validateRequest(body);
    if (validationError) {
      return createErrorResponse(validationError, HTTP_STATUS.BAD_REQUEST);
    }

    const { email } = body;
    const baseUrl = getBaseUrl(req);

    const db = await connectDB();
    const users = db.collection("users");

    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security, we return success even if user doesn't exist
      return createSuccessResponse(RESPONSES.RESET_LINK_SENT);
    }

    // Generate reset token and expiry
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    // Update user with reset token
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          resetToken,
          resetTokenExpiry,
        },
      }
    );

    // Send password reset email
    await handleEmailSending(resetToken, user.email, baseUrl);

    return createSuccessResponse(RESPONSES.RESET_LINK_SENT);
  } catch (error) {
    console.error("Forgot password error:", error);
    const errorMessage = error instanceof Error ? error.message : RESPONSES.INTERNAL_ERROR;
    return createErrorResponse(errorMessage, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

// Helper function for email sending
const handleEmailSending = async (resetToken: string, userEmail: string, baseUrl: string): Promise<void> => {
  try {
    const emailSent = await sendPasswordResetEmail(resetToken, userEmail, baseUrl);
    
    if (emailSent) {
      console.log(`Password reset email sent successfully to: ${userEmail}`);
    } else {
      console.warn(`Failed to send password reset email to: ${userEmail}. Token: ${resetToken}`);
      logFallbackLink(resetToken, userEmail, baseUrl);
    }
  } catch (emailError) {
    console.error("Email sending error:", emailError);
    // Don't fail the request if email fails - for security, we still return success
    logFallbackLink(resetToken, userEmail, baseUrl);
  }
};

const logFallbackLink = (resetToken: string, userEmail: string, baseUrl: string): void => {
  console.log(`Fallback reset link for ${userEmail}: ${baseUrl}/reset-password?token=${resetToken}`);
};