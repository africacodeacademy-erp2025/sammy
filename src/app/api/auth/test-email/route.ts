import { NextResponse } from "next/server";
import { testEmailConfiguration } from "../../../../../lib/email";

export async function GET() {
  try {
    // Check if we're in development mode
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Test endpoint not available in production" },
        { status: 403 }
      );
    }

    const isConfigured = await testEmailConfiguration();
    
    return NextResponse.json({
      success: true,
      emailConfigured: isConfigured,
      message: isConfigured 
        ? "Email configuration is valid and working" 
        : "Email configuration test failed - check environment variables",
    });
  } catch (err: unknown) {
    console.error("Email test error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}