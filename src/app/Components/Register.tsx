"use client";
import React, { useState } from "react";

type RegisterProps = {
  onSwitchToLogin: () => void;
  onRegisterSuccess?: () => void;
};

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      onSwitchToLogin();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/90 p-8 rounded-2xl shadow-lg w-full max-w-md backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Create Account
      </h2>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <input
        type="email"
        placeholder="Email"
        className="w-full mb-4 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full mb-4 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        type="password"
        placeholder="Confirm Password"
        className="w-full mb-4 p-3 rounded-xl bg-gray-800/80 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button
        onClick={handleRegister}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all flex justify-center items-center"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          "Register"
        )}
      </button>
      <p className="text-white/60 mt-4 text-center text-sm">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-purple-500 hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
}
