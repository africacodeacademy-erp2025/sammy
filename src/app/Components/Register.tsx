"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800/50 p-8 rounded-2xl shadow-lg border border-gray-700/50 w-full max-w-md lg:w-[460px]">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Create Account
      </h2>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <input
        type="email"
        placeholder="Email"
        className="w-full mb-4 p-3 rounded-xl bg-gray-900/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700/50"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <div className="relative mb-4">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          className="w-full p-3 rounded-xl bg-gray-900/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700/50"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      <div className="relative mb-4">
        <input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm Password"
          className="w-full p-3 rounded-xl bg-gray-900/80 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700/50"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
        >
          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

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

      <p className="text-gray-400 mt-4 text-center text-sm">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-purple-400 hover:text-purple-300 hover:underline"
        >
          Login
        </button>
      </p>
    </div>
  );
}
