/**
 * Recurring Schedule Manager Utility
 *
 * Provides clean, reusable functions for managing recurring schedules.
 * Handles pattern validation, occurrence calculation, and human-readable formatting.
 */

import {
  RecurrencePattern,
  FrequencyType,
  DayOfWeek,
  RecurringScheduleTemplate,
} from "../src/app/Types/recurring";

/**
 * Validates a recurrence pattern
 */
export function validateRecurrencePattern(pattern: RecurrencePattern): {
  isValid: boolean;
  error?: string;
} {
  // Validate interval
  if (pattern.interval < 1) {
    return { isValid: false, error: "Interval must be at least 1" };
  }

  // Validate time format (HH:mm)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(pattern.timeOfDay)) {
    return {
      isValid: false,
      error: "Time must be in HH:mm format (00:00 - 23:59)",
    };
  }

  // Validate weekly pattern
  if (pattern.frequency === "weekly") {
    if (!pattern.daysOfWeek || pattern.daysOfWeek.length === 0) {
      return {
        isValid: false,
        error: "Weekly recurrence requires at least one day of week",
      };
    }
  }

  // Validate monthly pattern
  if (pattern.frequency === "monthly") {
    if (
      !pattern.dayOfMonth ||
      pattern.dayOfMonth < 1 ||
      pattern.dayOfMonth > 31
    ) {
      return {
        isValid: false,
        error: "Monthly recurrence requires day of month (1-31)",
      };
    }
  }

  // Validate end conditions
  if (pattern.endDate && pattern.maxOccurrences) {
    return {
      isValid: false,
      error: "Cannot specify both endDate and maxOccurrences",
    };
  }

  return { isValid: true };
}

/**
 * Calculate the next occurrence time based on recurrence pattern
 */
export function calculateNextOccurrence(
  pattern: RecurrencePattern,
  lastOccurrence?: Date
): Date {
  const now = lastOccurrence || new Date();
  const [hours, minutes] = pattern.timeOfDay.split(":").map(Number);

  let nextDate = new Date(now);

  switch (pattern.frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + pattern.interval);
      nextDate.setHours(hours, minutes, 0, 0);
      break;

    case "weekly":
      nextDate = calculateNextWeeklyOccurrence(
        now,
        pattern.daysOfWeek!,
        hours,
        minutes,
        pattern.interval
      );
      break;

    case "monthly":
      nextDate = calculateNextMonthlyOccurrence(
        now,
        pattern.dayOfMonth!,
        hours,
        minutes,
        pattern.interval
      );
      break;

    case "custom":
      // Custom intervals in days
      nextDate.setDate(nextDate.getDate() + pattern.interval);
      nextDate.setHours(hours, minutes, 0, 0);
      break;
  }

  return nextDate;
}

/**
 * Calculate next weekly occurrence
 */
function calculateNextWeeklyOccurrence(
  from: Date,
  daysOfWeek: DayOfWeek[],
  hours: number,
  minutes: number,
  interval: number
): Date {
  const dayNumbers = daysOfWeek.map((day) => getDayNumber(day)).sort();
  const currentDay = from.getDay();

  // Find next occurrence in the current week
  let nextDay = dayNumbers.find((day) => {
    if (day > currentDay) return true;
    if (day === currentDay) {
      // Check if time hasn't passed yet
      const testDate = new Date(from);
      testDate.setHours(hours, minutes, 0, 0);
      return testDate > from;
    }
    return false;
  });

  const nextDate = new Date(from);

  if (nextDay !== undefined) {
    // Next occurrence is in current week
    const daysToAdd = nextDay - currentDay;
    nextDate.setDate(nextDate.getDate() + daysToAdd);
  } else {
    // Next occurrence is in next week(s)
    const daysToAdd = 7 * interval - currentDay + dayNumbers[0];
    nextDate.setDate(nextDate.getDate() + daysToAdd);
  }

  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

/**
 * Calculate next monthly occurrence
 */
function calculateNextMonthlyOccurrence(
  from: Date,
  dayOfMonth: number,
  hours: number,
  minutes: number,
  interval: number
): Date {
  const nextDate = new Date(from);

  // Check if we can schedule in current month
  const currentDay = from.getDate();
  if (dayOfMonth > currentDay) {
    nextDate.setDate(dayOfMonth);
  } else if (dayOfMonth === currentDay) {
    // Check if time hasn't passed
    const testDate = new Date(from);
    testDate.setHours(hours, minutes, 0, 0);
    if (testDate > from) {
      nextDate.setDate(dayOfMonth);
    } else {
      nextDate.setMonth(nextDate.getMonth() + interval);
      nextDate.setDate(Math.min(dayOfMonth, getLastDayOfMonth(nextDate)));
    }
  } else {
    // Move to next month(s)
    nextDate.setMonth(nextDate.getMonth() + interval);
    nextDate.setDate(Math.min(dayOfMonth, getLastDayOfMonth(nextDate)));
  }

  nextDate.setHours(hours, minutes, 0, 0);
  return nextDate;
}

/**
 * Get day number (0 = Sunday, 6 = Saturday)
 */
function getDayNumber(day: DayOfWeek): number {
  const days: DayOfWeek[] = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days.indexOf(day);
}

/**
 * Get last day of month
 */
function getLastDayOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calculate next N occurrences
 */
export function calculateNextOccurrences(
  pattern: RecurrencePattern,
  count: number = 5,
  startFrom?: Date
): Date[] {
  const occurrences: Date[] = [];
  let currentDate = startFrom || new Date();

  for (let i = 0; i < count; i++) {
    const nextOccurrence = calculateNextOccurrence(pattern, currentDate);

    // Check end conditions
    if (pattern.endDate && nextOccurrence > new Date(pattern.endDate)) {
      break;
    }

    occurrences.push(nextOccurrence);
    currentDate = nextOccurrence;
  }

  return occurrences;
}

/**
 * Generate human-readable description of recurrence pattern
 */
export function generateHumanReadable(pattern: RecurrencePattern): string {
  const time = formatTime(pattern.timeOfDay);

  switch (pattern.frequency) {
    case "daily":
      if (pattern.interval === 1) {
        return `Every day at ${time}`;
      }
      return `Every ${pattern.interval} days at ${time}`;

    case "weekly":
      const days = pattern.daysOfWeek!.join(", ");
      if (pattern.interval === 1) {
        return `Every ${days} at ${time}`;
      }
      return `Every ${pattern.interval} weeks on ${days} at ${time}`;

    case "monthly":
      const dayOrdinal = getOrdinal(pattern.dayOfMonth!);
      if (pattern.interval === 1) {
        return `Monthly on the ${dayOrdinal} at ${time}`;
      }
      return `Every ${pattern.interval} months on the ${dayOrdinal} at ${time}`;

    case "custom":
      return `Every ${pattern.interval} days at ${time}`;

    default:
      return `At ${time}`;
  }
}

/**
 * Format time from HH:mm to 12-hour format
 */
function formatTime(timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get ordinal suffix for day numbers
 */
function getOrdinal(day: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = day % 100;
  return day + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

/**
 * Check if template should create more occurrences
 */
export function shouldCreateMoreOccurrences(
  template: RecurringScheduleTemplate
): boolean {
  // Check status
  if (template.status !== "active") {
    return false;
  }

  // Check max occurrences
  if (
    template.recurrencePattern.maxOccurrences &&
    template.occurrenceCount >= template.recurrencePattern.maxOccurrences
  ) {
    return false;
  }

  // Check end date
  if (template.recurrencePattern.endDate) {
    const endDate = new Date(template.recurrencePattern.endDate);
    const now = new Date();
    if (now > endDate) {
      return false;
    }
  }

  return true;
}

/**
 * Format date for display
 */
export function formatOccurrenceDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
