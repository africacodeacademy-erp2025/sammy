import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";

// Track when the worker last ran (in-memory cache)
// In production, you might want to store this in Redis or MongoDB
let lastWorkerRun: Date | null = null;

export async function GET(request: NextRequest) {
  try {
    const db = await connectDB();
    const agendaJobs = db.collection("agendaJobs");

    // Find the check-recurring-posts job
    const recurringJob = await agendaJobs.findOne({
      name: "check-recurring-posts",
    });

    if (!recurringJob) {
      return NextResponse.json({
        success: false,
        error: "Worker job not found",
      });
    }

    // Get the last run time
    const lastRunAt = recurringJob.lastRunAt
      ? new Date(recurringJob.lastRunAt)
      : null;
    const nextRunAt = recurringJob.nextRunAt
      ? new Date(recurringJob.nextRunAt)
      : null;

    const now = new Date();
    let secondsUntilNextRun = 60; // Default to 60 seconds

    if (nextRunAt) {
      // Calculate seconds until next run
      secondsUntilNextRun = Math.max(
        0,
        Math.floor((nextRunAt.getTime() - now.getTime()) / 1000)
      );
    } else if (lastRunAt) {
      // If no nextRunAt, calculate based on lastRunAt + 60 seconds
      const estimatedNextRun = new Date(lastRunAt.getTime() + 60 * 1000);
      secondsUntilNextRun = Math.max(
        0,
        Math.floor((estimatedNextRun.getTime() - now.getTime()) / 1000)
      );
    }

    return NextResponse.json({
      success: true,
      lastRunAt: lastRunAt?.toISOString() || null,
      nextRunAt: nextRunAt?.toISOString() || null,
      secondsUntilNextRun,
      currentTime: now.toISOString(),
    });
  } catch (error: any) {
    console.error("Error getting worker status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
