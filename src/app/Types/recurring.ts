/**
 * Recurring Schedule Type Definitions
 *
 * This file contains all types related to recurring post scheduling functionality.
 * These types are separate from the main Types.ts to maintain clean separation of concerns.
 */

export type FrequencyType = "daily" | "weekly" | "monthly" | "custom";

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

/**
 * Recurrence pattern configuration
 */
export interface RecurrencePattern {
  /** Frequency type */
  frequency: FrequencyType;

  /** Interval for the frequency (e.g., every 2 days, every 3 weeks) */
  interval: number;

  /** Days of week for weekly recurrence */
  daysOfWeek?: DayOfWeek[];

  /** Day of month (1-31) for monthly recurrence */
  dayOfMonth?: number;

  /** Time of day in HH:mm format (24-hour) */
  timeOfDay: string;

  /** Optional end date (ISO string) */
  endDate?: string;

  /** Optional max number of occurrences */
  maxOccurrences?: number;

  /** Human-readable description of the pattern */
  humanReadable: string;
}

/**
 * Recurring schedule template stored in database
 */
export interface RecurringScheduleTemplate {
  _id?: string;
  userId: string;
  prompt: string;
  platform: string;
  status: "active" | "paused" | "completed" | "deleted";
  isRecurring: true;
  recurrencePattern: RecurrencePattern;

  /** Total occurrences created so far */
  occurrenceCount: number;

  /** Last time an occurrence was created */
  lastOccurrenceCreatedAt?: Date;

  /** Next scheduled occurrence time */
  nextOccurrenceTime?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * AI detection result for recurring patterns
 */
export interface RecurrenceDetectionResult {
  /** Whether a recurring pattern was detected */
  isRecurring: boolean;

  /** Confidence level (0.0 - 1.0) */
  confidence: number;

  /** Detected recurrence pattern (null if not recurring or low confidence) */
  pattern: RecurrencePattern | null;

  /** One-time schedule if detected (ISO string) */
  oneTimeSchedule?: string | null;

  /** Suggestions if pattern is unclear */
  suggestions?: string[];
}

/**
 * Request body for creating recurring schedule
 */
export interface CreateRecurringScheduleRequest {
  prompt: string;
  platform: string;
  recurrencePattern: RecurrencePattern;
}

/**
 * Request body for updating recurring schedule
 */
export interface UpdateRecurringScheduleRequest {
  templateId: string;
  status?: "active" | "paused";
  recurrencePattern?: RecurrencePattern;
  prompt?: string;
}

/**
 * Response for recurring schedule operations
 */
export interface RecurringScheduleResponse {
  success: boolean;
  template?: RecurringScheduleTemplate;
  message?: string;
  error?: string;
  nextOccurrences?: {
    date: string;
    formattedDate: string;
  }[];
}
