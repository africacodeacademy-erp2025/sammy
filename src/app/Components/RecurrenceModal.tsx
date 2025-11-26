"use client";
import React, { useState, useEffect } from "react";
import { RotateCw, CheckSquare, Square } from "lucide-react";
import Button from "./UI/Button";

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (recurrenceSettings: RecurrenceSettings) => void;
  frequency: "daily" | "weekly" | "monthly";
  time: string; // 24-hour format HH:mm
  prompt: string;
  detectedDays?: number[]; // Pre-detected days from the prompt
  availablePlatforms: string[]; // Connected platforms the user can post to
}

export interface RecurrenceSettings {
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  selectedDays?: number[]; // For daily: 0 (Sun) to 6 (Sat)
  selectedMonths?: number[]; // For monthly: 1 (Jan) to 12 (Dec)
  platforms: string[]; // Array of selected platforms
  prompt: string;
  timezoneOffset?: number; // Browser's timezone offset in minutes
}

const DAYS_OF_WEEK = [
  { name: "Sun", value: 0 },
  { name: "Mon", value: 1 },
  { name: "Tue", value: 2 },
  { name: "Wed", value: 3 },
  { name: "Thu", value: 4 },
  { name: "Fri", value: 5 },
  { name: "Sat", value: 6 },
];

const MONTHS = [
  { name: "January", value: 1 },
  { name: "February", value: 2 },
  { name: "March", value: 3 },
  { name: "April", value: 4 },
  { name: "May", value: 5 },
  { name: "June", value: 6 },
  { name: "July", value: 7 },
  { name: "August", value: 8 },
  { name: "September", value: 9 },
  { name: "October", value: 10 },
  { name: "November", value: 11 },
  { name: "December", value: 12 },
];

export default function RecurrenceModal({
  isOpen,
  onClose,
  onConfirm,
  frequency,
  time,
  prompt,
  detectedDays,
  availablePlatforms,
}: RecurrenceModalProps) {
  const [selectedTime, setSelectedTime] = useState(time);
  // compute browser timezone offset for display (minutes)
  const browserOffsetMinutes =
    typeof window !== "undefined" ? new Date().getTimezoneOffset() : 0;
  const browserOffsetHours = -browserOffsetMinutes / 60; // e.g. -120 -> +2
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<
    "daily" | "weekly" | "monthly"
  >(frequency);

  // Reset state when modal opens with new data
  useEffect(() => {
    setSelectedTime(time);
    setSelectedFrequency(frequency);
    // Pre-select detected days if provided
    setSelectedDays(detectedDays || []);
    setSelectedMonths([]);
    // Pre-select all available platforms by default
    setSelectedPlatforms(availablePlatforms || []);
  }, [isOpen, time, detectedDays, frequency, availablePlatforms]);

  if (!isOpen) return null;

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleMonthToggle = (month: number) => {
    setSelectedMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleConfirm = () => {
    // Get browser's timezone offset in minutes
    // getTimezoneOffset() returns offset in minutes (positive for west of UTC, negative for east)
    // Example: UTC+2 (South Africa) returns -120 minutes
    const timezoneOffset = new Date().getTimezoneOffset();

    const settings: RecurrenceSettings = {
      frequency: selectedFrequency,
      time: selectedTime,
      platforms: selectedPlatforms,
      prompt,
      timezoneOffset, // Send timezone offset to backend for UTC conversion
    };

    if (selectedFrequency === "daily" && selectedDays.length > 0) {
      settings.selectedDays = selectedDays;
    }

    if (selectedFrequency === "monthly" && selectedMonths.length > 0) {
      settings.selectedMonths = selectedMonths;
    }

    onConfirm(settings);
  };

  const isConfirmDisabled = () => {
    if (selectedPlatforms.length === 0) return true;
    if (selectedFrequency === "daily" && selectedDays.length === 0) return true;
    if (selectedFrequency === "monthly" && selectedMonths.length === 0)
      return true;
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-gray-700/50">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <RotateCw className="w-6 h-6" />
            Set Up Recurring Post
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Configure your {selectedFrequency} posting schedule
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Platforms <span className="text-red-400">*</span>
            </label>
            {availablePlatforms.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {availablePlatforms.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => handlePlatformToggle(platform)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      selectedPlatforms.includes(platform)
                        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                    }`}
                  >
                    {selectedPlatforms.includes(platform) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span className="capitalize">{platform}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-amber-300/80 bg-amber-900/20 px-4 py-3 rounded-lg border border-amber-700/50">
                ⚠️ No platforms connected. Please connect your social media
                accounts first.
              </div>
            )}
            {availablePlatforms.length > 0 &&
              selectedPlatforms.length === 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Please select at least one platform
                </p>
              )}
          </div>

          {/* Frequency Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Frequency
            </label>
            <select
              value={selectedFrequency}
              onChange={(e) =>
                setSelectedFrequency(
                  e.target.value as "daily" | "weekly" | "monthly"
                )
              }
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border-2 border-gray-700 
                       focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none 
                       transition duration-300 cursor-pointer"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Time Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Time (24-hour format, local)
            </label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border-2 border-gray-700 
                       focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none 
                       transition duration-300"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {selectedTime} (local time, UTC
              {browserOffsetHours >= 0
                ? `+${browserOffsetHours}`
                : browserOffsetHours}
              )
            </p>
          </div>

          {/* Days Selection (for Daily frequency) */}
          {selectedFrequency === "daily" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select Days <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={`py-2 px-1 rounded-lg text-sm font-medium transition-all duration-200
                      ${
                        selectedDays.includes(day.value)
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                      }`}
                  >
                    {day.name}
                  </button>
                ))}
              </div>
              {selectedDays.length === 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Please select at least one day
                </p>
              )}
            </div>
          )}

          {/* Months Selection (for Monthly frequency) */}
          {selectedFrequency === "monthly" && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select Months <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {MONTHS.map((month) => (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => handleMonthToggle(month.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200
                      ${
                        selectedMonths.includes(month.value)
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                      }`}
                  >
                    {month.name}
                  </button>
                ))}
              </div>
              {selectedMonths.length === 0 && (
                <p className="text-xs text-red-400 mt-2">
                  Please select at least one month
                </p>
              )}
            </div>
          )}

          {/* Weekly - No additional options needed */}
          {selectedFrequency === "weekly" && (
            <div className="px-4 py-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
              <p className="text-sm text-blue-300">
                📅 This post will be published weekly at {selectedTime} (local
                time)
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700/50 flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isConfirmDisabled()}
            className={`flex-1 ${
              isConfirmDisabled() ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            Confirm Schedule
          </Button>
        </div>
      </div>
    </div>
  );
}
