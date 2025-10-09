"use client";
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, User, Mail, Lock } from "lucide-react";

// Types
type Tab = "email" | "password";

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PasswordFormData {
  current: string;
  new: string;
  confirm: string;
}

interface PasswordVisibility {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

// Constants
const INITIAL_PASSWORD_FORM: PasswordFormData = {
  current: "",
  new: "",
  confirm: "",
};

const INITIAL_PASSWORD_VISIBILITY: PasswordVisibility = {
  current: false,
  new: false,
  confirm: false,
};

const API_ENDPOINTS = {
  USER: "/api/user",
  CHANGE_PASSWORD: "/api/auth/change-password",
  UPDATE_EMAIL: "/api/auth/update-email",
} as const;

export default function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  // User Data
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  
  // Password Form State
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>(INITIAL_PASSWORD_FORM);
  const [passwordVisibility, setPasswordVisibility] = useState<PasswordVisibility>(INITIAL_PASSWORD_VISIBILITY);

  // Helper functions
  const getAuthToken = (): string | null => localStorage.getItem("token");

  const resetFormState = useCallback(() => {
    setPasswordForm(INITIAL_PASSWORD_FORM);
    setPasswordVisibility(INITIAL_PASSWORD_VISIBILITY);
    setMessage("");
    setError("");
    setActiveTab("email");
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(API_ENDPOINTS.USER, {
        headers: { authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        setUserEmail(userData.email);
        setNewEmail(userData.email);
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUserData();
      resetFormState();
    }
  }, [isOpen, fetchUserData, resetFormState]);

  // Validation helpers
  const validatePasswordForm = (): string | null => {
    const { current, new: newPass, confirm } = passwordForm;
    
    if (!current || !newPass || !confirm) {
      return "All fields are required";
    }
    
    if (newPass !== confirm) {
      return "New passwords do not match";
    }
    
    if (newPass.length < 6) {
      return "New password must be at least 6 characters";
    }
    
    return null;
  };

  const validateEmailForm = (): string | null => {
    if (!newEmail) {
      return "Email is required";
    }
    
    if (newEmail === userEmail) {
      return "New email must be different from current email";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return "Please enter a valid email address";
    }
    
    return null;
  };

  // API call helpers
  const makeAuthenticatedRequest = async (
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = getAuthToken();
    if (!token) throw new Error("No authentication token found");

    return fetch(endpoint, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  };

  // Form handlers
  const handlePasswordSubmit = async (): Promise<void> => {
    setError("");
    setMessage("");

    const validationError = validatePasswordForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.new,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setPasswordForm(INITIAL_PASSWORD_FORM);
      } else {
        setError(data.error || "Failed to update password");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update password";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (): Promise<void> => {
    setError("");
    setMessage("");

    const validationError = validateEmailForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await makeAuthenticatedRequest(API_ENDPOINTS.UPDATE_EMAIL, {
        method: "PUT",
        body: JSON.stringify({ newEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setUserEmail(data.email);
        setNewEmail(data.email);
      } else {
        setError(data.error || "Failed to update email");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update email";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions for password form
  const updatePasswordField = (field: keyof PasswordFormData, value: string): void => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field: keyof PasswordVisibility): void => {
    setPasswordVisibility(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Tab switching helper
  const switchTab = (tab: Tab): void => {
    setActiveTab(tab);
    setError("");
    setMessage("");
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed top-0 right-0 h-full w-80 bg-gray-900 border-l border-gray-700
          transform transition-transform duration-300 z-50 shadow-2xl flex flex-col
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
              <User size={16} />
            </div>
            <div>
              <h2 className="text-white font-semibold">Profile Settings</h2>
              {userEmail && <p className="text-xs text-gray-400">{userEmail}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => switchTab("email")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "email"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Mail size={16} />
              Email
            </button>
            <button
              onClick={() => switchTab("password")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "password"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700"
              }`}
            >
              <Lock size={16} />
              Password
            </button>
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {message && (
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 mb-4">
              <p className="text-green-400 text-sm">{message}</p>
            </div>
          )}

          {/* Email Update Tab */}
          {activeTab === "email" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Update Email</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Email
                </label>
                <input
                  type="email"
                  value={userEmail || ""}
                  disabled
                  className="w-full p-3 rounded-xl bg-gray-700/50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter new email address"
                />
              </div>

              <button
                onClick={handleEmailSubmit}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all flex justify-center items-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Update Email"
                )}
              </button>

              <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <p className="text-blue-400 text-xs">
                  Make sure you have access to the new email address. You&apos;ll need to verify it.
                </p>
              </div>
            </div>
          )}

          {/* Password Update Tab */}
          {activeTab === "password" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Change Password</h3>

              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={passwordVisibility.current ? "text" : "password"}
                    value={passwordForm.current}
                    onChange={(e) => updatePasswordField("current", e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("current")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    {passwordVisibility.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={passwordVisibility.new ? "text" : "password"}
                    value={passwordForm.new}
                    onChange={(e) => updatePasswordField("new", e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("new")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    {passwordVisibility.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={passwordVisibility.confirm ? "text" : "password"}
                    value={passwordForm.confirm}
                    onChange={(e) => updatePasswordField("confirm", e.target.value)}
                    className="w-full p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("confirm")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  >
                    {passwordVisibility.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handlePasswordSubmit}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all flex justify-center items-center"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Update Password"
                )}
              </button>

              <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <p className="text-blue-400 text-xs">
                  Password must be at least 6 characters long. Make sure to use a strong password with a mix of letters, numbers, and symbols.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}