/**
 * Recurring Schedules API Endpoint
 *
 * Manages recurring schedule templates (CRUD operations).
 * Separate from agent route to maintain clean separation of concerns.
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";
import { getUserFromRequest } from "../../../../lib/auth";
import {
  RecurringScheduleTemplate,
  CreateRecurringScheduleRequest,
  UpdateRecurringScheduleRequest,
  RecurringScheduleResponse,
} from "../../Types/recurring";
import {
  validateRecurrencePattern,
  calculateNextOccurrences,
  formatOccurrenceDate,
  generateHumanReadable,
} from "../../../../lib/recurringScheduleManager";

/**
 * GET - Fetch all recurring schedule templates for the user
 */
export async function GET(req: NextRequest) {
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

    const db = await connectDB();
    const templates = await db
      .collection("recurringSchedules")
      .find({
        userId: user._id.toString(),
        isActive: { $in: [true, false] }, // Show both active and paused
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Transform the data to match the expected format
    const transformedTemplates = templates.map((template: any) => {
      // Calculate next occurrence if not present
      let nextOccurrenceTime = template.nextOccurrenceTime;
      if (!nextOccurrenceTime && template.pattern) {
        try {
          const nextOccurrences = calculateNextOccurrences(template.pattern, 1);
          nextOccurrenceTime = nextOccurrences[0]?.toISOString();
        } catch (error) {
          console.error("Error calculating next occurrence:", error);
        }
      }

      return {
        ...template,
        _id: template._id?.toString(),
        recurrencePattern: template.pattern, // Map 'pattern' to 'recurrencePattern'
        status: template.isActive ? "active" : "paused", // Map isActive to status
        nextOccurrenceTime,
        occurrenceCount: template.occurrenceCount || 0,
      };
    });

    return NextResponse.json(
      {
        success: true,
        templates: transformedTemplates,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching recurring schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch recurring schedules" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new recurring schedule template
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

    const body: CreateRecurringScheduleRequest = await req.json();
    const { prompt, platform, recurrencePattern } = body;

    // Validate required fields
    if (!prompt || !platform || !recurrencePattern) {
      return NextResponse.json(
        {
          error: "Missing required fields: prompt, platform, recurrencePattern",
        },
        { status: 400 }
      );
    }

    // Validate recurrence pattern
    const validation = validateRecurrencePattern(recurrencePattern);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Generate human-readable description if not provided
    if (!recurrencePattern.humanReadable) {
      recurrencePattern.humanReadable =
        generateHumanReadable(recurrencePattern);
    }

    // Calculate next occurrence time
    const nextOccurrences = calculateNextOccurrences(recurrencePattern, 1);
    const nextOccurrenceTime = nextOccurrences[0]?.toISOString();

    // Create template using the same schema as confirm route
    const template = {
      userId: user._id.toString(),
      prompt,
      platform,
      pattern: {
        ...recurrencePattern,
        humanReadable:
          recurrencePattern.humanReadable ||
          generateHumanReadable(recurrencePattern),
      },
      isActive: true,
      occurrenceCount: 0,
      nextOccurrenceTime,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastProcessedAt: null,
    };

    const db = await connectDB();
    const result = await db
      .collection("recurringSchedules")
      .insertOne(template);

    // Get preview of next occurrences
    const previewOccurrences = calculateNextOccurrences(recurrencePattern, 5);
    const nextOccurrencesFormatted = previewOccurrences.map((date) => ({
      date: date.toISOString(),
      formattedDate: formatOccurrenceDate(date),
    }));

    const response: RecurringScheduleResponse = {
      success: true,
      template: {
        _id: result.insertedId.toString(),
        userId: user._id.toString(),
        prompt,
        platform,
        status: "active",
        isRecurring: true,
        recurrencePattern,
        occurrenceCount: 0,
        nextOccurrenceTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message: "Recurring schedule created successfully",
      nextOccurrences: nextOccurrencesFormatted,
    };

    console.log(
      `✅ Created recurring schedule ${result.insertedId} for user ${user._id}`
    );

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating recurring schedule:", error);
    return NextResponse.json(
      { error: "Failed to create recurring schedule" },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a recurring schedule template
 */
export async function PUT(req: NextRequest) {
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

    const body: UpdateRecurringScheduleRequest = await req.json();
    const { templateId, status, recurrencePattern, prompt } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(templateId);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid template ID format" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const templates = db.collection("recurringSchedules");

    // Verify ownership
    const existing = await templates.findOne({
      _id: objectId,
      userId: user._id.toString(),
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Recurring schedule not found or unauthorized" },
        { status: 404 }
      );
    }

    // Build update object
    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (status) {
      // Map status to isActive field
      updateFields.isActive = status === "active";
    }

    if (prompt) {
      updateFields.prompt = prompt;
    }

    if (recurrencePattern) {
      // Validate new pattern
      const validation = validateRecurrencePattern(recurrencePattern);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      if (!recurrencePattern.humanReadable) {
        recurrencePattern.humanReadable =
          generateHumanReadable(recurrencePattern);
      }

      // Use 'pattern' field instead of 'recurrencePattern'
      updateFields.pattern = recurrencePattern;

      // Recalculate next occurrence
      const nextOccurrences = calculateNextOccurrences(recurrencePattern, 1);
      updateFields.nextOccurrenceTime = nextOccurrences[0]?.toISOString();
    }

    // Update template
    await templates.updateOne({ _id: objectId }, { $set: updateFields });

    console.log(`✅ Updated recurring schedule ${templateId}`);

    return NextResponse.json(
      {
        success: true,
        message: "Recurring schedule updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating recurring schedule:", error);
    return NextResponse.json(
      { error: "Failed to update recurring schedule" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a recurring schedule template
 */
export async function DELETE(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();

    // Convert string ID to ObjectId for MongoDB query
    let objectId;
    try {
      objectId = new ObjectId(templateId);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid template ID format" },
        { status: 400 }
      );
    }

    // Permanently delete the recurring schedule from database
    const result = await db.collection("recurringSchedules").deleteOne({
      _id: objectId,
      userId: user._id.toString(),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Recurring schedule not found or unauthorized" },
        { status: 404 }
      );
    }

    // Also delete any pending scheduled posts created from this template
    await db.collection("scheduledPosts").deleteMany({
      parentPostId: templateId, // parentPostId is stored as string
      status: "scheduled", // Only delete pending ones, not ready_for_review
    });

    console.log(
      `✅ Permanently deleted recurring schedule ${templateId} and removed pending occurrences`
    );

    return NextResponse.json(
      {
        success: true,
        message: "Recurring schedule deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting recurring schedule:", error);
    return NextResponse.json(
      { error: "Failed to delete recurring schedule" },
      { status: 500 }
    );
  }
}
