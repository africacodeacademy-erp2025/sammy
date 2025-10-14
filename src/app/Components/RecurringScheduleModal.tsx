"use client";

import React, { useState, useEffect } from "react";
import Button from "./UI/Button";
import Input from "./UI/Input";
import Label from "./UI/Label";
import Card from "./UI/Card";
import CardContent from "./UI/CardContent";
import CardHeader from "./UI/CardHeader";
import CardTitle from "./UI/CardTitle";
import type { RecurrencePattern, FrequencyType } from "../Types/recurring";

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pattern: RecurrencePattern, prompt?: string) => Promise<void>;
  initialPattern?: RecurrencePattern;
  prompt?: string;
  platform?: string;
  allowPromptEdit?: boolean; // New prop to enable prompt editing
}

const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialPattern,
  prompt,
  platform,
  allowPromptEdit = false,
}) => {
  const [frequency, setFrequency] = useState<FrequencyType>(
    (initialPattern?.frequency === "custom"
      ? "daily"
      : initialPattern?.frequency) || "daily"
  );
  const [interval, setInterval] = useState<number>(
    initialPattern?.interval || 1
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<string>(
    initialPattern?.timeOfDay || "09:00"
  );
  const [editablePrompt, setEditablePrompt] = useState<string>(prompt || "");
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Parse time of day for display
  const [hour, minute] = timeOfDay.split(":").map((s) => parseInt(s) || 0);

  // Update prompt when prop changes (for editing mode)
  useEffect(() => {
    if (prompt) {
      setEditablePrompt(prompt);
    }
  }, [prompt]);

  // Calculate preview dates whenever pattern changes
  useEffect(() => {
    const calculatePreview = () => {
      const dates: Date[] = [];
      const now = new Date();
      let current = new Date(now);

      // Set time from timeOfDay string
      const [h, m] = timeOfDay.split(":").map((s) => parseInt(s) || 0);
      current.setHours(h, m, 0, 0);

      // If time has passed today, start from tomorrow
      if (current <= now) {
        current.setDate(current.getDate() + 1);
      }

      for (let i = 0; i < 5; i++) {
        if (frequency === "daily") {
          dates.push(new Date(current));
          current.setDate(current.getDate() + interval);
        } else if (frequency === "weekly") {
          // Find next matching day
          if (daysOfWeek.length === 0) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + interval * 7);
          } else {
            let found = false;
            let attempts = 0;
            while (!found && attempts < 7) {
              if (daysOfWeek.includes(current.getDay())) {
                dates.push(new Date(current));
                found = true;
              }
              current.setDate(current.getDate() + 1);
              attempts++;
            }
          }
        } else if (frequency === "monthly") {
          dates.push(new Date(current));
          current.setMonth(current.getMonth() + interval);
        }

        if (dates.length >= 5) break;
      }

      setPreviewDates(
        dates.map((d) =>
          d.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        )
      );
    };

    calculatePreview();
  }, [frequency, interval, daysOfWeek, timeOfDay]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const dayMapping: Array<
        | "Sunday"
        | "Monday"
        | "Tuesday"
        | "Wednesday"
        | "Thursday"
        | "Friday"
        | "Saturday"
      > = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];

      const pattern: RecurrencePattern = {
        frequency,
        interval,
        daysOfWeek:
          frequency === "weekly" && daysOfWeek.length > 0
            ? daysOfWeek.map((d) => dayMapping[d])
            : undefined,
        timeOfDay,
        humanReadable: generateHumanReadable(),
      };

      await onConfirm(pattern, allowPromptEdit ? editablePrompt : undefined);
      onClose();
    } catch (error) {
      console.error("Error confirming recurring schedule:", error);
      alert("Failed to create recurring schedule. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const generateHumanReadable = (): string => {
    let description = "";

    if (interval === 1) {
      description = `Every ${frequency}`;
    } else {
      description = `Every ${interval} ${frequency}s`;
    }

    if (frequency === "weekly" && daysOfWeek.length > 0) {
      const days = daysOfWeek.map((d) => dayNames[d]).join(", ");
      description += ` on ${days}`;
    }

    description += ` at ${timeOfDay}`;
    return description;
  };

  const updateTime = (newHour: number, newMinute: number) => {
    const h = Math.max(0, Math.min(23, newHour));
    const m = Math.max(0, Math.min(59, newMinute));
    setTimeOfDay(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700/50 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-white text-2xl">
            Set Up Recurring Schedule
          </CardTitle>
          {prompt && !allowPromptEdit && (
            <p className="text-sm text-gray-400 mt-2">
              <strong className="text-gray-300">Prompt:</strong> {prompt}
            </p>
          )}
          {platform && (
            <p className="text-sm text-gray-400">
              <strong className="text-gray-300">Platform:</strong>{" "}
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Prompt Editor (if editing is enabled) */}
          {allowPromptEdit && (
            <div>
              <Label htmlFor="prompt" className="text-gray-300">
                Post Prompt
              </Label>
              <textarea
                id="prompt"
                value={editablePrompt}
                onChange={(e) => setEditablePrompt(e.target.value)}
                placeholder="Enter what you want to post..."
                rows={3}
                className="w-full mt-1 p-3 bg-gray-800/80 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Frequency Selection */}
          <div>
            <Label htmlFor="frequency" className="text-gray-300">
              Frequency
            </Label>
            <select
              id="frequency"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "daily" | "weekly" | "monthly")
              }
              className="w-full mt-1 p-3 bg-gray-800/80 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="daily" className="bg-gray-800">
                Daily
              </option>
              <option value="weekly" className="bg-gray-800">
                Weekly
              </option>
              <option value="monthly" className="bg-gray-800">
                Monthly
              </option>
            </select>
          </div>

          {/* Interval */}
          <div>
            <Label htmlFor="interval" className="text-gray-300">
              Every
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="interval"
                type="number"
                min="1"
                max="30"
                value={interval}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInterval(parseInt(e.target.value) || 1)
                }
                className="w-20 p-3 bg-gray-800/80 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-300">
                {frequency === "daily" && "day(s)"}
                {frequency === "weekly" && "week(s)"}
                {frequency === "monthly" && "month(s)"}
              </span>
            </div>
          </div>

          {/* Days of Week (for weekly) */}
          {frequency === "weekly" && (
            <div>
              <Label className="text-gray-300">Days of Week</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    onClick={() => toggleDayOfWeek(index)}
                    className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                      daysOfWeek.includes(index)
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-lg shadow-purple-500/20"
                        : "bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-700/50 hover:border-gray-600"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {frequency === "weekly" && daysOfWeek.length === 0 && (
                <p className="text-sm text-red-400 mt-2">
                  Please select at least one day
                </p>
              )}
            </div>
          )}

          {/* Time of Day */}
          <div>
            <Label htmlFor="time" className="text-gray-300">
              Time
            </Label>
            <div className="flex gap-2 mt-1 items-center">
              <Input
                id="hour"
                type="number"
                min="0"
                max="23"
                value={hour}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateTime(parseInt(e.target.value) || 0, minute)
                }
                className="w-20 p-3 bg-gray-800/80 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Hour"
              />
              <span className="flex items-center text-gray-400 text-xl">:</span>
              <Input
                id="minute"
                type="number"
                min="0"
                max="59"
                step="5"
                value={minute}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateTime(hour, parseInt(e.target.value) || 0)
                }
                className="w-20 p-3 bg-gray-800/80 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Min"
              />
              <span className="flex items-center text-sm text-gray-400">
                (24-hour format)
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="border-t border-gray-700/50 pt-4">
            <Label className="text-gray-300">Preview: Next 5 Occurrences</Label>
            <div className="mt-2 space-y-2">
              {previewDates.length > 0 ? (
                previewDates.map((date, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-800/50 border border-gray-700/30 rounded-lg text-sm text-gray-300 hover:bg-gray-800/70 transition-colors"
                  >
                    <span className="text-purple-400 font-semibold">
                      {index + 1}.
                    </span>{" "}
                    {date}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Configure pattern to see preview
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end border-t border-gray-700/50 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                isLoading || (frequency === "weekly" && daysOfWeek.length === 0)
              }
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Recurring Schedule"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringScheduleModal;
