"use client";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

// Constants
const API_ENDPOINTS = {
  FORGOT_PASSWORD: "/api/auth/forgot-password",
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Types
interface ForgotPasswordProps {
  onBack: () => void;
}

interface FormState {
  email: string;
  loading: boolean;
  message: string;
  error: string;
  submitted: boolean;
}

export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [formState, setFormState] = useState<FormState>({
    email: "",
    loading: false,
    message: "",
    error: "",
    submitted: false,
  });

  // Helper functions
  const updateFormState = (updates: Partial<FormState>): void => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  const validateEmail = (): string | null => {
    if (!formState.email) return "Email is required";
    if (!EMAIL_REGEX.test(formState.email)) return "Please enter a valid email address";
    return null;
  };

  const handleSubmit = async (): Promise<void> => {
    const validationError = validateEmail();
    if (validationError) {
      updateFormState({ error: validationError });
      return;
    }

    updateFormState({ error: "", loading: true });
    
    try {
      const response = await fetch(API_ENDPOINTS.FORGOT_PASSWORD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formState.email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        updateFormState({ 
          message: data.message, 
          submitted: true,
          loading: false 
        });
      } else {
        updateFormState({ 
          error: data.error || "Failed to send reset email",
          loading: false 
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email";
      updateFormState({ 
        error: errorMessage,
        loading: false 
      });
    }
  };

  if (formState.submitted) {
    return (
      <div className="bg-gray-900/90 p-8 rounded-2xl shadow-lg backdrop-blur-sm w-full max-w-md lg:w-[460px]">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">✓</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Check Your Email</h2>
          <p className="text-gray-300 mb-6">{formState.message}</p>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all flex justify-center items-center gap-2"
          >
            <ArrowLeft size={18} />
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/90 p-8 rounded-2xl shadow-lg backdrop-blur-sm w-full max-w-md lg:w-[460px]">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        Back to Login
      </button>
      
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Forgot Password</h2>
      <p className="text-gray-400 mb-6 text-center text-sm">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>
      
      {formState.error && <p className="text-red-500 text-sm mb-4">{formState.error}</p>}
      
      <input
        type="email"
        placeholder="Email address"
        className="w-full mb-6 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={formState.email}
        onChange={(e) => updateFormState({ email: e.target.value })}
        onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
      />
      
      <button
        onClick={handleSubmit}
        disabled={formState.loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all flex justify-center items-center"
      >
        {formState.loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          "Send Reset Link"
        )}
      </button>
    </div>
  );
}