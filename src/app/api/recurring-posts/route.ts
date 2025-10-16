/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";

/**
 * Calculate the next occurrence timestamp based on frequency and recurrence settings
 * Converts local time to UTC using timezone offset
 */
function calculateNextOccurrence(
  frequency: "daily" | "weekly" | "monthly",
  time: string, // HH:mm format in LOCAL TIME
  selectedDays?: number[], // For daily: 0 (Sun) to 6 (Sat)
  selectedMonths?: number[], // For monthly: 1 (Jan) to 12 (Dec)
  timezoneOffset?: number // Browser's timezone offset in minutes (e.g., -120 for UTC+2)
): Date {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);

  // Default to 0 if no timezone offset provided (assumes UTC)
  const offsetMinutes = timezoneOffset !== undefined ? timezoneOffset : 0;

  if (frequency === "weekly") {
    // Weekly: next occurrence is 7 days from now at the specified time
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + 7);

    // Set time in UTC (not local)
    // User wants 11:03 LOCAL → we need to calculate what that is in UTC
    // offset is +120 for UTC-2 (120 minutes behind UTC)
    // So 11:03 local = 11:03 + 2 hours = 13:03 UTC
    // Formula: UTC hours = local hours + (offset / 60)
    const utcHours = hours + Math.floor(offsetMinutes / 60);
    const utcMinutes = minutes + (offsetMinutes % 60);

    nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);

    // If the time has already passed, schedule for next week
    if (nextDate <= now) {
      nextDate.setDate(nextDate.getDate() + 7);
    }

    return nextDate;
  }

  if (frequency === "daily" && selectedDays && selectedDays.length > 0) {
    // Daily with specific days: find next occurrence of selected day
    const currentDay = now.getDay();
    let daysToAdd = 0;
    let foundNextDay = false;

    // Sort selected days to find the next one
    const sortedDays = [...selectedDays].sort((a, b) => a - b);

    // First, try to find a day later this week
    for (const day of sortedDays) {
      if (day > currentDay) {
        daysToAdd = day - currentDay;
        foundNextDay = true;
        break;
      } else if (day === currentDay) {
        // Same day - check if time has passed (in UTC)
        const todayAtTime = new Date(now);

        // Set UTC time based on local time + offset
        const utcHours = hours + Math.floor(offsetMinutes / 60);
        const utcMinutes = minutes + (offsetMinutes % 60);
        todayAtTime.setUTCHours(utcHours, utcMinutes, 0, 0);

        if (todayAtTime > now) {
          daysToAdd = 0;
          foundNextDay = true;
          break;
        }
      }
    }

    // If no day found this week, get the first day next week
    if (!foundNextDay) {
      const firstDay = sortedDays[0];
      daysToAdd = 7 - currentDay + firstDay;
    }

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysToAdd);

    // Set UTC time based on local time + offset
    const utcHours = hours + Math.floor(offsetMinutes / 60);
    const utcMinutes = minutes + (offsetMinutes % 60);
    nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);

    return nextDate;
  }

  if (frequency === "monthly" && selectedMonths && selectedMonths.length > 0) {
    // Monthly: find next occurrence in selected months
    const currentMonth = now.getMonth() + 1; // 1-12
    let nextDate = new Date(now);

    // Sort selected months
    const sortedMonths = [...selectedMonths].sort((a, b) => a - b);

    // Calculate UTC time from local time
    const utcHours = hours + Math.floor(offsetMinutes / 60);
    const utcMinutes = minutes + (offsetMinutes % 60);

    // Try to find a month this year
    let foundMonth = false;
    for (const month of sortedMonths) {
      if (month > currentMonth) {
        nextDate.setMonth(month - 1); // Convert to 0-11
        nextDate.setDate(1); // First day of the month
        nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);
        foundMonth = true;
        break;
      } else if (month === currentMonth) {
        // Same month - check if we can still schedule this month
        const testDate = new Date(now);
        testDate.setUTCHours(utcHours, utcMinutes, 0, 0);

        if (testDate > now) {
          nextDate = testDate;
          foundMonth = true;
          break;
        }
      }
    }

    // If no month found this year, get the first month next year
    if (!foundMonth) {
      const firstMonth = sortedMonths[0];
      nextDate.setFullYear(now.getFullYear() + 1);
      nextDate.setMonth(firstMonth - 1);
      nextDate.setDate(1);
      nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);
    }

    return nextDate;
  }

  // Fallback: next day at specified time
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + 1);

  // Set UTC time based on local time + offset
  const utcHours = hours + Math.floor(offsetMinutes / 60);
  const utcMinutes = minutes + (offsetMinutes % 60);
  nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);

  return nextDate;
  nextDate.setHours(hours, minutes, 0, 0);

  // Convert to UTC
  const utcTime = nextDate.getTime() - offsetMinutes * 60 * 1000;
  return new Date(utcTime);
}

/**
 * POST - Create a new recurring post schedule
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    const body = await req.json();

    const {
      frequency,
      time,
      selectedDays,
      selectedMonths,
      platform,
      prompt,
      timezoneOffset,
    } = body;

    // Validate required fields
    if (!frequency || !time || !platform || !prompt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required fields: frequency, time, platform, or prompt",
        },
        { status: 400 }
      );
    }

    // Validate frequency-specific requirements
    if (frequency === "daily" && (!selectedDays || selectedDays.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Daily frequency requires at least one selected day",
        },
        { status: 400 }
      );
    }

    if (
      frequency === "monthly" &&
      (!selectedMonths || selectedMonths.length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Monthly frequency requires at least one selected month",
        },
        { status: 400 }
      );
    }

    // Calculate next occurrence (converts local time to UTC)
    const nextOccurrence = calculateNextOccurrence(
      frequency,
      time,
      selectedDays,
      selectedMonths,
      timezoneOffset // Pass timezone offset for UTC conversion
    );

    console.log(
      `📅 Creating recurring post - Local time: ${time}, Timezone offset: ${timezoneOffset}min, UTC nextOccurrence: ${nextOccurrence.toISOString()}`
    );

    // Connect to database
    const db = await connectDB();

    // Create recurring post document
    const recurringPost = {
      userId,
      prompt,
      platform,
      frequency,
      time, // Store time in HH:mm format
      selectedDays: selectedDays || null,
      selectedMonths: selectedMonths || null,
      nextOccurrence: nextOccurrence, // Store as Date object for MongoDB compatibility
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastExecuted: null, // Will be updated when a post is generated
    };

    const result = await db
      .collection("recurringPosts")
      .insertOne(recurringPost);

    // Format the success message
    const frequencyText =
      frequency === "daily"
        ? `on ${selectedDays?.length || 0} selected day(s)`
        : frequency === "weekly"
        ? "every week"
        : `in ${selectedMonths?.length || 0} selected month(s)`;

    const nextOccurrenceDate = nextOccurrence.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const formattedMessage = `✅ Recurring ${platform} post scheduled successfully!\n\n📅 Frequency: ${frequency}\n⏰ Time: ${time}\n📍 Schedule: ${frequencyText}\n🔜 Next post: ${nextOccurrenceDate}`;

    return NextResponse.json({
      success: true,
      message: formattedMessage,
      recurringPostId: result.insertedId.toString(),
      nextOccurrence: nextOccurrence.toISOString(),
    });
  } catch (err: any) {
    console.error("Error creating recurring post:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create recurring post schedule",
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve all recurring posts for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    const db = await connectDB();

    // Get URL parameters for filtering
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get("isActive");
    const platform = searchParams.get("platform");

    // Build query
    const query: any = { userId };
    if (isActive !== null) {
      query.isActive = isActive === "true";
    }
    if (platform) {
      query.platform = platform;
    }

    const recurringPosts = await db
      .collection("recurringPosts")
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      recurringPosts: recurringPosts.map((post) => ({
        ...post,
        _id: post._id.toString(),
      })),
    });
  } catch (err: any) {
    console.error("Error fetching recurring posts:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch recurring posts",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a recurring post schedule
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    const body = await req.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Recurring post ID is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const { ObjectId } = require("mongodb");

    // Verify ownership
    const existingPost = await db.collection("recurringPosts").findOne({
      _id: new ObjectId(id),
      userId,
    });

    if (!existingPost) {
      return NextResponse.json(
        { success: false, error: "Recurring post not found" },
        { status: 404 }
      );
    }

    // If time or frequency settings are updated, recalculate next occurrence
    let nextOccurrence = existingPost.nextOccurrence;
    if (
      updateFields.frequency ||
      updateFields.time ||
      updateFields.selectedDays ||
      updateFields.selectedMonths
    ) {
      const frequency = updateFields.frequency || existingPost.frequency;
      const time = updateFields.time || existingPost.time;
      const selectedDays =
        updateFields.selectedDays !== undefined
          ? updateFields.selectedDays
          : existingPost.selectedDays;
      const selectedMonths =
        updateFields.selectedMonths !== undefined
          ? updateFields.selectedMonths
          : existingPost.selectedMonths;
      const timezoneOffset = updateFields.timezoneOffset; // Get timezone offset from request

      nextOccurrence = calculateNextOccurrence(
        frequency,
        time,
        selectedDays,
        selectedMonths,
        timezoneOffset // Pass timezone offset for UTC conversion
      );

      const now = new Date();
      console.log(
        `📅 Updated recurring post ${id} - Local time: ${time}, UTC nextOccurrence: ${nextOccurrence.toISOString()}`
      );

      if (nextOccurrence <= now) {
        console.log(
          `⚠️  WARNING: nextOccurrence is in the past! It should be processed on the next worker check (within 1 minute)`
        );
      }
    }

    // Update the document
    const updateDoc = {
      ...updateFields,
      nextOccurrence: nextOccurrence, // Store as Date object for MongoDB compatibility
      updatedAt: new Date(),
    };

    await db
      .collection("recurringPosts")
      .updateOne({ _id: new ObjectId(id), userId }, { $set: updateDoc });

    return NextResponse.json({
      success: true,
      message: "Recurring post updated successfully",
      nextOccurrence: nextOccurrence.toISOString(),
    });
  } catch (err: any) {
    console.error("Error updating recurring post:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update recurring post",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a recurring post schedule
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Recurring post ID is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const { ObjectId } = require("mongodb");

    // Delete the recurring post (verify ownership)
    const result = await db.collection("recurringPosts").deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Recurring post not found or unauthorized",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recurring post deleted successfully",
    });
  } catch (err: any) {
    console.error("Error deleting recurring post:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete recurring post",
      },
      { status: 500 }
    );
  }
}
