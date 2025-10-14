"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "./UI/Button";
import RecurringScheduleModal from "./RecurringScheduleModal";
import type {
  RecurringScheduleTemplate,
  RecurrencePattern,
} from "../Types/recurring";

interface RecurringScheduleManagerProps {
  onClose: () => void;
}

// Constants
const API_ENDPOINTS = {
  RECURRING_SCHEDULES: "/api/recurring-schedules",
} as const;

const MESSAGES = {
  DELETE_CONFIRM:
    "Are you sure you want to delete this recurring schedule? Future posts will not be created.",
  UPDATE_SUCCESS: "Recurring schedule updated successfully!",
  DELETE_SUCCESS: "Recurring schedule deleted successfully!",
  UPDATE_FAILED: "Failed to update recurring schedule",
  DELETE_FAILED: "Failed to delete recurring schedule",
  TRY_AGAIN: "Please try again.",
} as const;

export default function RecurringScheduleManager({
  onClose,
}: RecurringScheduleManagerProps) {
  // State management
  const [templates, setTemplates] = useState<RecurringScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] =
    useState<RecurringScheduleTemplate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const token = localStorage.getItem("token");

  // Fetch templates with useCallback for optimization
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.RECURRING_SCHEDULES, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error fetching recurring schedules:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Delete handler
  const handleDelete = useCallback(
    async (templateId: string) => {
      if (!confirm(MESSAGES.DELETE_CONFIRM)) {
        return;
      }

      setProcessingId(templateId);
      try {
        const res = await fetch(
          `${API_ENDPOINTS.RECURRING_SCHEDULES}?id=${templateId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (data.success) {
          setTemplates((prev) => prev.filter((t) => t._id !== templateId));
          alert(MESSAGES.DELETE_SUCCESS);
        } else {
          alert(data.error || MESSAGES.DELETE_FAILED);
        }
      } catch (error) {
        console.error("Error deleting recurring schedule:", error);
        alert(`${MESSAGES.DELETE_FAILED}. ${MESSAGES.TRY_AGAIN}`);
      } finally {
        setProcessingId(null);
      }
    },
    [token]
  );

  // Toggle status handler
  const handleToggleStatus = useCallback(
    async (templateId: string, currentStatus: string) => {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      setProcessingId(templateId);

      try {
        const res = await fetch(API_ENDPOINTS.RECURRING_SCHEDULES, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            templateId,
            status: newStatus,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setTemplates((prev) =>
            prev.map((t) =>
              t._id === templateId ? { ...t, status: newStatus } : t
            )
          );
        } else {
          alert(data.error || MESSAGES.UPDATE_FAILED);
        }
      } catch (error) {
        console.error("Error updating recurring schedule:", error);
        alert(`${MESSAGES.UPDATE_FAILED}. ${MESSAGES.TRY_AGAIN}`);
      } finally {
        setProcessingId(null);
      }
    },
    [token]
  );

  // Edit handlers
  const handleEdit = useCallback((template: RecurringScheduleTemplate) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  }, []);

  const handleEditConfirm = useCallback(
    async (pattern: RecurrencePattern, prompt?: string) => {
      if (!editingTemplate || !editingTemplate._id) return;

      setProcessingId(editingTemplate._id);
      try {
        const updateData: any = {
          templateId: editingTemplate._id,
          recurrencePattern: pattern,
        };

        // Include prompt if it was edited
        if (prompt !== undefined && prompt !== editingTemplate.prompt) {
          updateData.prompt = prompt;
        }

        const res = await fetch(API_ENDPOINTS.RECURRING_SCHEDULES, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updateData),
        });

        const data = await res.json();
        if (data.success) {
          await fetchTemplates();
          setShowEditModal(false);
          setEditingTemplate(null);
          alert(MESSAGES.UPDATE_SUCCESS);
        } else {
          alert(data.error || MESSAGES.UPDATE_FAILED);
        }
      } catch (error) {
        console.error("Error updating recurring schedule:", error);
        alert(`${MESSAGES.UPDATE_FAILED}. ${MESSAGES.TRY_AGAIN}`);
      } finally {
        setProcessingId(null);
      }
    },
    [editingTemplate, token, fetchTemplates]
  );

  // Format date utility
  const formatNextOccurrence = useCallback((isoString?: string) => {
    if (!isoString) return "Calculating...";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  // Get status badge classes
  const getStatusBadgeClass = (status: string) => {
    return status === "active"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  };

  // Get status display text
  const getStatusDisplay = (status: string) => {
    return status === "active" ? "🟢 Active" : "⏸️ Paused";
  };

  // Get platform display
  const getPlatformDisplay = (platform: string) => {
    return platform === "twitter" ? "𝕏 Twitter" : "📘 Facebook";
  };

  // Get toggle button text
  const getToggleButtonText = (status: string, isProcessing: boolean) => {
    if (isProcessing) return "...";
    return status === "active" ? "⏸️ Pause" : "▶️ Resume";
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center z-50">
        <div className="text-white text-lg">Loading recurring schedules...</div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-gray-950 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/50 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-700/50 text-white hover:bg-gray-700 transition-colors flex-shrink-0"
                aria-label="Go back"
              >
                ←
              </button>
              <div className="flex-1 sm:flex-initial">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Recurring Schedules
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  Manage your automated posting schedules
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-400 w-full sm:w-auto text-right">
              {templates.length} schedule{templates.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="text-5xl sm:text-6xl mb-4 sm:mb-6">🔄</div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">
                No Recurring Schedules Yet
              </h3>
              <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6 max-w-md">
                Create your first recurring schedule by using natural language
                like:
                <br />
                "Post every day at 9am" or "Post every Monday at 2pm"
              </p>
              <Button onClick={onClose}>Go Back to Chat</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              {templates.map((template) => {
                if (!template._id) return null;

                const isProcessing = processingId === template._id;

                return (
                  <div
                    key={template._id}
                    className="bg-gray-800/80 border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-gray-600/50 transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span
                            className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(
                              template.status
                            )}`}
                          >
                            {getStatusDisplay(template.status)}
                          </span>
                          <span className="px-2 sm:px-3 py-1 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            {getPlatformDisplay(template.platform)}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-1 truncate">
                          {template.recurrencePattern?.humanReadable ||
                            "Recurring Schedule"}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-400">
                          Created{" "}
                          {new Date(template.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Prompt */}
                    <div className="mb-3 sm:mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/30">
                      <p className="text-xs sm:text-sm text-gray-300 leading-relaxed break-words">
                        {template.prompt}
                      </p>
                    </div>

                    {/* Schedule Details */}
                    <div className="mb-3 sm:mb-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="text-gray-500">Next Post:</span>
                        <span className="text-gray-300 font-medium truncate">
                          {formatNextOccurrence(template.nextOccurrenceTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <span className="text-gray-500">Posts Created:</span>
                        <span className="text-gray-300 font-medium">
                          {template.occurrenceCount || 0}
                        </span>
                      </div>
                      {template.recurrencePattern?.daysOfWeek &&
                        template.recurrencePattern.daysOfWeek.length > 0 && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm flex-wrap">
                            <span className="text-gray-500">Days:</span>
                            {template.recurrencePattern.daysOfWeek.map(
                              (day) => (
                                <span
                                  key={day}
                                  className="px-2 py-0.5 text-xs rounded bg-gray-700/50 text-gray-300"
                                >
                                  {day}
                                </span>
                              )
                            )}
                          </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        onClick={() =>
                          template._id &&
                          handleToggleStatus(template._id, template.status)
                        }
                        disabled={isProcessing}
                        variant="secondary"
                        className="flex-1 text-sm"
                      >
                        {getToggleButtonText(template.status, isProcessing)}
                      </Button>
                      <Button
                        onClick={() => handleEdit(template)}
                        disabled={isProcessing}
                        variant="secondary"
                        className="flex-1 text-sm"
                      >
                        ✏️ Edit
                      </Button>
                      <Button
                        onClick={() =>
                          template._id && handleDelete(template._id)
                        }
                        disabled={isProcessing}
                        className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-sm"
                      >
                        {isProcessing ? "..." : "🗑️ Delete"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingTemplate && (
        <RecurringScheduleModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          onConfirm={handleEditConfirm}
          initialPattern={editingTemplate.recurrencePattern}
          prompt={editingTemplate.prompt}
          platform={editingTemplate.platform}
          allowPromptEdit={true}
        />
      )}
    </>
  );
}
