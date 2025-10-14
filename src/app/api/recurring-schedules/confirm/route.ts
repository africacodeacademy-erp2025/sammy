import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import { getUserFromRequest } from "../../../../../lib/auth";
import {
  validateRecurrencePattern,
  calculateNextOccurrences,
} from "../../../../../lib/recurringScheduleManager";
import type { RecurrencePattern } from "../../../Types/recurring";

/**
 * POST /api/recurring-schedules/confirm
 * Confirms and creates a recurring schedule template after user approval
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Your session has expired. Please log in again! 🔐",
        },
        { status: 401 }
      );
    }

    const userId = user._id.toString();

    const body = await req.json();
    const { pattern, platform, prompt } = body;

    if (!pattern || !platform || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: pattern, platform, prompt",
        },
        { status: 400 }
      );
    }

    // Validate the pattern
    const validation = validateRecurrencePattern(pattern as RecurrencePattern);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error || "Invalid recurrence pattern",
        },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const collection = db.collection("recurringSchedules");

    // Create the recurring schedule template
    const template = {
      userId,
      platform,
      prompt,
      pattern: {
        ...pattern,
        humanReadable: pattern.humanReadable || generateHumanReadable(pattern),
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastProcessedAt: null,
    };

    const result = await collection.insertOne(template);

    // Calculate next occurrence for immediate feedback
    const nextOccurrences = calculateNextOccurrences(pattern, 1);

    return NextResponse.json({
      success: true,
      templateId: result.insertedId,
      message: `Recurring schedule created successfully! Next post: ${
        nextOccurrences[0]?.toLocaleString() || "Soon"
      }`,
      nextOccurrence: nextOccurrences[0]?.toISOString() || null,
    });
  } catch (error) {
    console.error("Error confirming recurring schedule:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create schedule",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper function to generate human-readable description
 */
function generateHumanReadable(pattern: RecurrencePattern): string {
  const { frequency, interval, daysOfWeek, timeOfDay } = pattern;

  let description = "";

  if (interval === 1) {
    description = `Every ${frequency}`;
  } else {
    description = `Every ${interval} ${frequency}s`;
  }

  if (daysOfWeek && daysOfWeek.length > 0) {
    // daysOfWeek is an array of day names, not indices
    const days = daysOfWeek.join(", ");
    description += ` on ${days}`;
  }

  if (timeOfDay) {
    // timeOfDay is already a string in HH:mm format
    description += ` at ${timeOfDay}`;
  }

  return description;
}
